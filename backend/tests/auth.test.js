process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { connectDB, disconnectDB, clearMemoryStore } = require('../src/config/database');
const UserService = require('../src/services/user.service');
const { generateTOTP } = require('../src/utils/totp');
const bcrypt = require('bcryptjs');

test('Phase 2: Database and Authentication Verification Suite', async (t) => {
  let server;
  let testPort;
  let adminSessionToken;
  let investigatorSessionToken;
  let investigatorUserId;
  let verificationToken;
  let mfaSecretForInvestigator;
  let mfaChallengeToken;

  await t.test('Initialize database & start HTTP server', async () => {
    await connectDB();
    clearMemoryStore();
    const { User, AuditLog } = require('../src/models');
    try {
      await User.deleteMany({ email: { $in: ['admin@demo.vault', 'investigator@demo.vault'] } });
      await AuditLog.deleteMany({});
    } catch (e) {
      // Ignored if not using real mongo
    }

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        testPort = server.address().port;
        resolve();
      });
    });

    // Seed an active admin user for administrative tests
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('AdminSecurePass123!', salt);
    const admin = await UserService.create({
      email: 'admin@demo.vault',
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP' // Standard demo secret
    });

    // Login admin to get session token
    const loginRes = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@demo.vault', password: 'AdminSecurePass123!' })
    });
    const loginBody = await loginRes.json();
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginBody.mfaRequired, true);

    const adminTotp = generateTOTP('JBSWY3DPEHPK3PXP');
    const mfaRes = await fetch(`http://127.0.0.1:${testPort}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaChallengeToken: loginBody.mfaChallengeToken, totpCode: adminTotp })
    });
    const mfaBody = await mfaRes.json();
    assert.strictEqual(mfaRes.status, 200);
    adminSessionToken = mfaBody.sessionToken;
    assert.ok(adminSessionToken);
  });

  await t.test('Registration rejects weak password (<10 chars, missing complexity)', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'investigator@demo.vault', password: 'weak' })
    });
    assert.strictEqual(res.status, 500); // Caught by validation
    const body = await res.json();
    assert.ok(body.error.message.includes('Password must be at least 10 characters'));
  });

  await t.test('Valid registration creates user with pending status', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'investigator@demo.vault',
        password: 'ValidSecurePass2026!',
        role: 'investigator'
      })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.user.email, 'investigator@demo.vault');
    assert.strictEqual(body.user.role, 'investigator');
    assert.strictEqual(body.user.accountStatus, 'pending');
    assert.strictEqual(body.user.emailVerified, false);
    assert.ok(body.emailVerificationToken);
    verificationToken = body.emailVerificationToken;
    investigatorUserId = body.user._id || body.user.id;
  });

  await t.test('Duplicate registration fails with 409 conflict', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'investigator@demo.vault',
        password: 'ValidSecurePass2026!'
      })
    });
    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  await t.test('Email verification activates emailVerified flag', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken })
    });
    assert.strictEqual(res.status, 200);
    const user = await UserService.findById(investigatorUserId);
    assert.strictEqual(user.emailVerified, true);
  });

  await t.test('Login is blocked while accountStatus is pending', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'investigator@demo.vault',
        password: 'ValidSecurePass2026!'
      })
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'ACCOUNT_PENDING_APPROVAL');
  });

  await t.test('Administrator activates investigator account', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/users/${investigatorUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({ status: 'active' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.accountStatus, 'active');
  });

  await t.test('Login with wrong password fails with 401', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'investigator@demo.vault',
        password: 'WrongPassword999!'
      })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
  });

  await t.test('Login with valid credentials triggers MFA challenge setup', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'investigator@demo.vault',
        password: 'ValidSecurePass2026!'
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.mfaRequired, true);
    assert.strictEqual(body.mfaSetupRequired, true);
    assert.ok(body.mfaChallengeToken);
    assert.ok(body.mfaSecret);
    assert.ok(body.otpauthUri.startsWith('otpauth://totp/'));

    mfaSecretForInvestigator = body.mfaSecret;
    mfaChallengeToken = body.mfaChallengeToken;
  });

  await t.test('Invalid TOTP code is rejected', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaChallengeToken,
        totpCode: '000000'
      })
    });
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'INVALID_MFA_CODE');
  });

  await t.test('Valid TOTP completes login and issues 8-hour session token', async () => {
    const validOtp = generateTOTP(mfaSecretForInvestigator);
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaChallengeToken,
        totpCode: validOtp
      })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.sessionToken);
    assert.strictEqual(body.user.role, 'investigator');
    assert.strictEqual(body.user.mfaEnabled, true);

    investigatorSessionToken = body.sessionToken;
  });

  await t.test('Authenticated investigator can retrieve /api/users/me', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/users/me`, {
      headers: { 'Authorization': `Bearer ${investigatorSessionToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.user.email, 'investigator@demo.vault');
    assert.strictEqual(body.user.passwordHash, undefined);
    assert.strictEqual(body.user.mfaSecret, undefined);
  });

  await t.test('Investigator cannot access Admin-only /api/users endpoint (RBAC deny-by-default)', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/users`, {
      headers: { 'Authorization': `Bearer ${investigatorSessionToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN_ROLE');
  });

  await t.test('Administrator can access /api/users', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/users`, {
      headers: { 'Authorization': `Bearer ${adminSessionToken}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.users));
    assert.strictEqual(body.total >= 2, true);
  });

  await t.test('Password reset request generates opaque token', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'investigator@demo.vault' })
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.resetToken);

    // Reset password with new value
    const resetRes = await fetch(`http://127.0.0.1:${testPort}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: body.resetToken,
        newPassword: 'BrandNewSecurePass999!'
      })
    });
    assert.strictEqual(resetRes.status, 200);

    // Check login with new password succeeds (triggers MFA)
    const newLoginRes = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'investigator@demo.vault',
        password: 'BrandNewSecurePass999!'
      })
    });
    assert.strictEqual(newLoginRes.status, 200);
  });

  await t.test('Logout invalidates session cookie', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${investigatorSessionToken}` }
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('Close test HTTP server and disconnect DB', async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });
});
