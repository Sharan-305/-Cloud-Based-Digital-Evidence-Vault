const AuthService = require('../services/auth.service');
const AuditService = require('../services/audit.service');

async function register(req, res, next) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required.',
          code: 'MISSING_CREDENTIALS',
          correlationId: req.correlationId
        }
      });
    }

    const result = await AuthService.register({
      email,
      password,
      role,
      correlationId: req.correlationId
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;
    const result = await AuthService.verifyEmail({
      token,
      correlationId: req.correlationId
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required.',
          code: 'MISSING_CREDENTIALS',
          correlationId: req.correlationId
        }
      });
    }

    const result = await AuthService.login({
      email,
      password,
      correlationId: req.correlationId
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function verifyMfa(req, res, next) {
  try {
    const { mfaChallengeToken, totpCode } = req.body;
    const result = await AuthService.verifyMfa({
      mfaChallengeToken,
      totpCode,
      correlationId: req.correlationId
    });

    // Also set secure HttpOnly cookie for session if client supports cookies
    res.cookie('vault_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('vault_token');

    if (req.user) {
      await AuditService.log({
        actorId: req.user._id || req.user.id,
        action: 'LOGOUT',
        targetType: 'USER',
        targetId: String(req.user._id || req.user.id),
        result: 'SUCCESS',
        correlationId: req.correlationId
      });
    }

    res.status(200).json({ message: 'Session terminated successfully.' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        error: {
          message: 'Email is required.',
          code: 'MISSING_EMAIL',
          correlationId: req.correlationId
        }
      });
    }

    const result = await AuthService.forgotPassword({
      email,
      correlationId: req.correlationId
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Reset token and newPassword are required.',
          code: 'MISSING_PARAMS',
          correlationId: req.correlationId
        }
      });
    }

    const result = await AuthService.resetPassword({
      token,
      newPassword,
      correlationId: req.correlationId
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verifyEmail,
  login,
  verifyMfa,
  logout,
  forgotPassword,
  resetPassword
};
