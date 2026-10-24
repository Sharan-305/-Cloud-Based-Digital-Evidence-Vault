const bcrypt = require('bcryptjs');
const UserService = require('./user.service');
const AuditService = require('./audit.service');
const { generateSecret, verifyTOTP, generateOtpauthUri } = require('../utils/totp');
const { signSessionToken, verifySessionToken, generateOpaqueToken, hashOpaqueToken } = require('../utils/token');

class AuthService {
  /**
   * Validate password complexity
   */
  static validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a string');
    }
    if (password.length < 10) {
      throw new Error('Password must be at least 10 characters long');
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      throw new Error('Password must contain uppercase, lowercase, numeric, and special characters');
    }
  }

  /**
   * Register a new user account
   */
  static async register({ email, password, role = 'investigator', correlationId }) {
    this.validatePasswordStrength(password);

    // Public registration cannot self-grant 'admin' role
    let requestedRole = 'investigator';
    if (role === 'auditor') requestedRole = 'auditor';

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Email verification token
    const { plainToken, tokenHash } = generateOpaqueToken();
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await UserService.create({
      email,
      passwordHash,
      role: requestedRole,
      accountStatus: 'pending', // Per master prompt: pending until admin approval
      emailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires,
      mfaEnabled: false
    });

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'USER_REGISTERED',
      targetType: 'USER',
      targetId: String(user._id || user.id),
      result: 'SUCCESS',
      correlationId,
      safeContext: { email: user.email, role: requestedRole, status: 'pending' }
    });

    return {
      user: user.toSafeJSON ? user.toSafeJSON() : user,
      emailVerificationToken: plainToken,
      message: 'Account registered successfully. Verification email token generated; account remains pending until Administrator activation.'
    };
  }

  /**
   * Verify email address using token
   */
  static async verifyEmail({ token, correlationId }) {
    if (!token) {
      const err = new Error('Verification token is required');
      err.status = 400;
      throw err;
    }

    const tokenHash = hashOpaqueToken(token);
    const user = await UserService.findByEmailVerificationTokenHash(tokenHash);
    if (!user) {
      const err = new Error('Invalid or expired email verification token');
      err.status = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    await UserService.update(user._id || user.id, {
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpires: null
    });

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'EMAIL_VERIFIED',
      targetType: 'USER',
      targetId: String(user._id || user.id),
      result: 'SUCCESS',
      correlationId,
      safeContext: { email: user.email }
    });

    return { message: 'Email verified successfully.' };
  }

  /**
   * Primary authentication step (Email + Password) -> Returns MFA challenge
   */
  static async login({ email, password, correlationId }) {
    const user = await UserService.findByEmail(email);
    if (!user) {
      await AuditService.log({
        systemActor: 'auth_service',
        action: 'LOGIN_FAILED',
        targetType: 'USER',
        targetId: null,
        result: 'FAILURE',
        correlationId,
        safeContext: { email: email.toLowerCase() }
      });
      const err = new Error('Invalid email or password');
      err.status = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const isMatch = await (user.comparePassword ? user.comparePassword(password) : bcrypt.compare(password, user.passwordHash));
    if (!isMatch) {
      await AuditService.log({
        actorId: user._id || user.id,
        action: 'LOGIN_FAILED',
        targetType: 'USER',
        targetId: String(user._id || user.id),
        result: 'FAILURE',
        correlationId,
        safeContext: { email: user.email }
      });
      const err = new Error('Invalid email or password');
      err.status = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Check account status
    if (user.accountStatus === 'pending') {
      const err = new Error('Your account is pending Administrator approval and activation.');
      err.status = 403;
      err.code = 'ACCOUNT_PENDING_APPROVAL';
      throw err;
    }

    if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled') {
      const err = new Error('Account access has been deactivated by an Administrator.');
      err.status = 403;
      err.code = 'ACCOUNT_DISABLED';
      throw err;
    }

    // Prepare MFA challenge
    let mfaSecret = user.mfaSecret;
    let mfaSetupRequired = false;
    let otpauthUri = null;

    if (!user.mfaEnabled || !mfaSecret) {
      mfaSecret = generateSecret();
      await UserService.update(user._id || user.id, { mfaSecret });
      mfaSetupRequired = true;
      otpauthUri = generateOtpauthUri({ secret: mfaSecret, accountName: user.email });
    }

    // Create short-lived challenge token (5 minutes)
    const mfaChallengeToken = signSessionToken({
      userId: String(user._id || user.id),
      email: user.email,
      stage: 'mfa_challenge'
    }, '5m');

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'LOGIN_CREDENTIALS_ACCEPTED',
      targetType: 'USER',
      targetId: String(user._id || user.id),
      result: 'SUCCESS',
      correlationId,
      safeContext: { mfaSetupRequired }
    });

    return {
      mfaRequired: true,
      mfaSetupRequired,
      mfaChallengeToken,
      otpauthUri,
      mfaSecret: mfaSetupRequired ? mfaSecret : undefined
    };
  }

  /**
   * Second authentication step: Verify TOTP code and grant session token
   */
  static async verifyMfa({ mfaChallengeToken, totpCode, correlationId }) {
    if (!mfaChallengeToken || !totpCode) {
      const err = new Error('MFA challenge token and 6-digit TOTP code are required');
      err.status = 400;
      err.code = 'MISSING_MFA_PARAMS';
      throw err;
    }

    let payload;
    try {
      payload = verifySessionToken(mfaChallengeToken);
    } catch (e) {
      const err = new Error('MFA session expired or invalid. Please sign in again.');
      err.status = 401;
      err.code = 'MFA_CHALLENGE_EXPIRED';
      throw err;
    }

    if (payload.stage !== 'mfa_challenge') {
      const err = new Error('Invalid authentication token stage');
      err.status = 403;
      throw err;
    }

    const user = await UserService.findById(payload.userId);
    if (!user || !user.mfaSecret) {
      const err = new Error('User not found or MFA not configured');
      err.status = 404;
      throw err;
    }

    // Verify TOTP with 1 step window (±30s)
    const isValid = verifyTOTP(totpCode, user.mfaSecret, 1);
    if (!isValid) {
      await AuditService.log({
        actorId: user._id || user.id,
        action: 'MFA_FAILED',
        targetType: 'USER',
        targetId: String(user._id || user.id),
        result: 'FAILURE',
        correlationId,
        safeContext: { reason: 'Incorrect TOTP code' }
      });
      const err = new Error('Invalid MFA authentication code');
      err.status = 401;
      err.code = 'INVALID_MFA_CODE';
      throw err;
    }

    // Enable MFA permanently & record last login
    await UserService.update(user._id || user.id, {
      mfaEnabled: true,
      lastLoginAt: new Date()
    });

    // Generate full session token (8 hours)
    const sessionToken = signSessionToken({
      userId: String(user._id || user.id),
      email: user.email,
      role: user.role,
      stage: 'authenticated'
    }, '8h');

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'LOGIN_MFA_SUCCESS',
      targetType: 'USER',
      targetId: String(user._id || user.id),
      result: 'SUCCESS',
      correlationId,
      safeContext: { role: user.role }
    });

    return {
      sessionToken,
      user: {
        id: String(user._id || user.id),
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        emailVerified: user.emailVerified,
        mfaEnabled: true
      }
    };
  }

  /**
   * Request password reset token
   */
  static async forgotPassword({ email, correlationId }) {
    const user = await UserService.findByEmail(email);
    // Generic response to prevent user enumeration
    if (!user) {
      return { message: 'If an account exists for this email, password reset instructions have been issued.' };
    }

    const { plainToken, tokenHash } = generateOpaqueToken();
    const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await UserService.update(user._id || user.id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires
    });

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'USER',
      targetId: String(user._id || user.id),
      result: 'SUCCESS',
      correlationId,
      safeContext: { email: user.email }
    });

    return {
      message: 'If an account exists for this email, password reset instructions have been issued.',
      resetToken: plainToken // Returned for testing / demo workflow
    };
  }

  /**
   * Reset password with valid token
   */
  static async resetPassword({ token, newPassword, correlationId }) {
    this.validatePasswordStrength(newPassword);

    const tokenHash = hashOpaqueToken(token);
    const user = await UserService.findByPasswordResetTokenHash(tokenHash);
    if (!user) {
      const err = new Error('Invalid or expired password reset token');
      err.status = 400;
      err.code = 'INVALID_RESET_TOKEN';
      throw err;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await UserService.update(user._id || user.id, {
      passwordHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null
    });

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'USER',
      targetId: String(user._id || user.id),
      result: 'SUCCESS',
      correlationId,
      safeContext: { email: user.email }
    });

    return { message: 'Password reset completed successfully. Please sign in with your new password.' };
  }
}

module.exports = AuthService;
