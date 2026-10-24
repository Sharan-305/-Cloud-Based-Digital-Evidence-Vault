const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/database');
const User = require('../src/models/User');
const Evidence = require('../src/models/Evidence');
const EvidenceVersion = require('../src/models/EvidenceVersion');
const CustodyEvent = require('../src/models/CustodyEvent');
const AccessRequest = require('../src/models/AccessRequest');
const Alert = require('../src/models/Alert');
const AuditLog = require('../src/models/AuditLog');
const BackupJob = require('../src/models/BackupJob');
const StorageService = require('../src/services/storage.service');
const { generateTOTP } = require('../src/utils/totp');
const bcrypt = require('bcryptjs');

let server;
let baseUrl;
const sharedMfaSecret = 'JBSWY3DPEHPK3PXP'; // Base32 test secret

let adminToken;
let investigatorToken;
let auditorToken;
let testEvidenceId;
let restrictedEvidenceId;
let tamperAlertId;

function makeRequest(pathName, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathName, baseUrl);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(rawBody.toString('utf8'));
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          rawBody
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function buildMultipartBody(fields, file) {
  const boundary = '----VaultE2ETestBoundary' + Math.random().toString(16).slice(2);
  const parts = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${k}"\r\n\r\n` +
      `${v}\r\n`
    );
  }

  if (file) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.contentType}\r\n\r\n`
    );
  }

  const headerBuffers = Buffer.from(parts.join(''), 'utf8');
  const footerBuffer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const fullBody = Buffer.concat([headerBuffers, file ? file.buffer : Buffer.alloc(0), footerBuffer]);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: fullBody
  };
}

test('Phase 7: Comprehensive Acceptance & Role Walkthrough Suite', async (t) => {
  await t.test('Initialize database, clean test state, and seed demo accounts', async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Clean DB
    await User.deleteMany({ email: { $in: ['admin@demo.vault', 'investigator@demo.vault', 'auditor@demo.vault'] } });
    await Evidence.deleteMany({});
    await EvidenceVersion.deleteMany({});
    await CustodyEvent.deleteMany({});
    await AccessRequest.deleteMany({});
    await Alert.deleteMany({});
    await AuditLog.deleteMany({});
    await BackupJob.deleteMany({});

    // Seed users with activated status
    const testPassword = 'Password123!@#Vault';
    const passwordHash = await bcrypt.hash(testPassword, 10);
    await User.create([
      {
        email: 'admin@demo.vault',
        passwordHash,
        role: 'admin',
        accountStatus: 'active',
        emailVerified: true,
        mfaEnabled: true,
        mfaSecret: sharedMfaSecret
      },
      {
        email: 'investigator@demo.vault',
        passwordHash,
        role: 'investigator',
        accountStatus: 'active',
        emailVerified: true,
        mfaEnabled: true,
        mfaSecret: sharedMfaSecret
      },
      {
        email: 'auditor@demo.vault',
        passwordHash,
        role: 'auditor',
        accountStatus: 'active',
        emailVerified: true,
        mfaEnabled: true,
        mfaSecret: sharedMfaSecret
      }
    ]);

    assert.ok(baseUrl);
  });

  await t.test('All three roles authenticate with password and valid TOTP MFA', async () => {
    for (const [role, email] of [
      ['admin', 'admin@demo.vault'],
      ['investigator', 'investigator@demo.vault'],
      ['auditor', 'auditor@demo.vault']
    ]) {
      // Step 1: Submit password credentials
      const loginRes = await makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'Password123!@#Vault'
        })
      });

      assert.equal(loginRes.status, 200, `Step 1 login failed for ${email}`);
      assert.ok(loginRes.body.mfaChallengeToken, 'MFA challenge token must be returned');

      // Step 2: Submit RFC 6238 TOTP verification code
      const totp = generateTOTP(sharedMfaSecret);
      const mfaRes = await makeRequest('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaChallengeToken: loginRes.body.mfaChallengeToken,
          totpCode: totp
        })
      });

      assert.equal(mfaRes.status, 200, `Step 2 MFA verification failed for ${email}`);
      assert.ok(mfaRes.body.sessionToken);
      assert.equal(mfaRes.body.user.role, role);

      if (role === 'admin') adminToken = mfaRes.body.sessionToken;
      if (role === 'investigator') investigatorToken = mfaRes.body.sessionToken;
      if (role === 'auditor') auditorToken = mfaRes.body.sessionToken;
    }
  });

  await t.test('Synthetic fixtures in sample-data/synthetic-metadata.json match vault requirements', async () => {
    const fixturePath = path.resolve(__dirname, '../../sample-data/synthetic-metadata.json');
    assert.ok(fs.existsSync(fixturePath), 'Synthetic fixtures file must exist');

    const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    assert.ok(Array.isArray(fixtures), 'Fixtures should be an array');
    assert.ok(fixtures.length >= 2, 'Should contain at least 2 synthetic evidence fixtures');

    for (const f of fixtures) {
      assert.ok(f.evidenceId.startsWith('EV-'));
      assert.ok(f.title);
      assert.ok(f.category);
      assert.ok(f.referenceId);
      assert.ok(f.versions && f.versions.length > 0);
      assert.equal(f.versions[0].hashAlgorithm, 'SHA-256');
      assert.equal(f.versions[0].signatureAlgorithm, 'Ed25519');
    }
  });

  await t.test('RBAC Intake Isolation: Only Investigator can ingest evidence into vault', async () => {
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const mp = buildMultipartBody({
      title: 'E2E Sealed Audit Log Capture',
      category: 'logs',
      referenceId: 'CASE-E2E-001',
      classification: 'confidential'
    }, {
      fieldname: 'file',
      filename: 'e2e_capture.pdf',
      contentType: 'application/pdf',
      buffer: pdfBytes
    });

    // Auditor intake attempt -> 403 Forbidden
    const auditorRes = await makeRequest('/api/evidence', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auditorToken}`,
        'Content-Type': mp.contentType
      },
      body: mp.body
    });
    assert.equal(auditorRes.status, 403);

    // Admin intake attempt -> 403 Forbidden (separation of duties: admin manages users/alerts, investigator manages evidence)
    const adminRes = await makeRequest('/api/evidence', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': mp.contentType
      },
      body: mp.body
    });
    assert.equal(adminRes.status, 403);

    // Investigator intake -> 201 Created
    const investigatorRes = await makeRequest('/api/evidence', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': mp.contentType
      },
      body: mp.body
    });
    assert.equal(investigatorRes.status, 201);
    assert.ok(investigatorRes.body.evidence.evidenceId);
    assert.equal(investigatorRes.body.state, 'COMPLETE');
    testEvidenceId = investigatorRes.body.evidence.evidenceId;
  });

  await t.test('Ingest restricted evidence item for access approval testing', async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const mp = buildMultipartBody({
      title: 'Restricted Forensic Disk Snapshot',
      category: 'forensic_archive',
      referenceId: 'CASE-E2E-RESTRICTED',
      classification: 'restricted'
    }, {
      fieldname: 'file',
      filename: 'restricted_snapshot.png',
      contentType: 'image/png',
      buffer: pngBytes
    });

    const res = await makeRequest('/api/evidence', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': mp.contentType
      },
      body: mp.body
    });
    assert.equal(res.status, 201);
    restrictedEvidenceId = res.body.evidence.evidenceId;
  });

  await t.test('Investigator cannot download restricted evidence without access grant', async () => {
    const res = await makeRequest(`/api/evidence/${restrictedEvidenceId}/download`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'RESTRICTED_ACCESS_REQUIRED');
  });

  await t.test('Investigator requests access; self-approval is strictly rejected', async () => {
    const reqRes = await makeRequest('/api/access-requests', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evidenceId: restrictedEvidenceId,
        requestedDuration: 8,
        reason: 'Forensic inspection for trial submission.'
      })
    });
    assert.equal(reqRes.status, 201);
    const requestId = reqRes.body.request.id || reqRes.body.request._id;

    // Self-approval attempt by investigator (forbidden by RBAC / self-approval prevention)
    const selfApproveRes = await makeRequest(`/api/access-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decisionReason: 'Self approval attempt' })
    });
    assert.equal(selfApproveRes.status, 403);

    // Administrator approves access request
    const adminApproveRes = await makeRequest(`/api/access-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decisionReason: 'Approved for court review' })
    });
    assert.equal(adminApproveRes.status, 200);
    assert.equal(adminApproveRes.body.request.decision, 'APPROVED');

    // Investigator can now download
    const downloadRes = await makeRequest(`/api/evidence/${restrictedEvidenceId}/download`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.equal(downloadRes.status, 200);
    assert.ok(downloadRes.rawBody.length > 0);
  });

  await t.test('Untampered evidence verifies as VALID with matching SHA-256 and Ed25519 signature', async () => {
    const verifyRes = await makeRequest(`/api/evidence/${testEvidenceId}/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.report.result, 'VALID');
    assert.equal(verifyRes.body.report.signatureValid, true);
  });

  await t.test('Byte tampering triggers MISMATCH_HASH, CRITICAL alert, and preserves baseline hash', async () => {
    const versions = await EvidenceVersion.find({ evidenceId: testEvidenceId }).sort({ versionNumber: 1 });
    const v1 = versions[0];
    const originalHash = v1.sha256;

    // Mutate stored bytes
    const tamperedBytes = Buffer.from('%PDF-1.4 TAMPERED PAYLOAD INSERTION');
    StorageService.tamperObjectVersion({
      key: v1.s3ObjectKey,
      versionId: v1.s3ObjectVersionId,
      buffer: tamperedBytes
    });

    const verifyRes = await makeRequest(`/api/evidence/${testEvidenceId}/verify`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.report.result, 'MISMATCH_HASH');

    // Check alert was created
    const alerts = await Alert.find({ evidenceId: testEvidenceId, status: 'OPEN' });
    assert.ok(alerts.length > 0);
    assert.equal(alerts[0].severity, 'CRITICAL');
    tamperAlertId = alerts[0]._id.toString();

    // Verify baseline hash was NOT altered in database
    const freshVersion = await EvidenceVersion.findById(v1._id);
    assert.equal(freshVersion.sha256, originalHash, 'Baseline SHA-256 hash must never be modified by recalculation');

    // Investigator cannot resolve alert
    const invResolveRes = await makeRequest(`/api/alerts/${tamperAlertId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resolutionNotes: 'Attempting fix' })
    });
    assert.equal(invResolveRes.status, 403);

    // Administrator resolves alert
    const adminResolveRes = await makeRequest(`/api/alerts/${tamperAlertId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resolutionNotes: 'Logged and contained within sandbox.' })
    });
    assert.equal(adminResolveRes.status, 200);
    assert.equal(adminResolveRes.body.alert.status, 'RESOLVED');
  });

  await t.test('Auditor generates and streams signed PDF Evidence Report', async () => {
    const reportRes = await makeRequest(`/api/evidence/${testEvidenceId}/report`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${auditorToken}` }
    });

    assert.equal(reportRes.status, 200);
    assert.equal(reportRes.headers['content-type'], 'application/pdf');
    assert.ok(reportRes.rawBody.length > 100);
    const pdfMagic = reportRes.rawBody.toString('utf8', 0, 5);
    assert.equal(pdfMagic, '%PDF-');
  });

  await t.test('Auditor can inspect audit logs; Investigator is denied', async () => {
    // Auditor access -> 200
    const auditRes = await makeRequest('/api/audit-logs', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${auditorToken}` }
    });
    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body.logs));
    assert.ok(auditRes.body.logs.length > 0);

    // Verify no passwords or private keys are exposed in safeContext
    const jsonStr = JSON.stringify(auditRes.body.logs);
    assert.ok(!jsonStr.includes('passwordHash'), 'Audit log must not contain password hashes');
    assert.ok(!jsonStr.includes('mfaSecret'), 'Audit log must not contain MFA secrets');

    // Investigator access -> 403
    const invAuditRes = await makeRequest('/api/audit-logs', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.equal(invAuditRes.status, 403);
  });

  await t.test('Administrator initiates system backup and verifies archive manifest', async () => {
    const backupRes = await makeRequest('/api/backups/run', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.equal(backupRes.status, 200);
    assert.equal(backupRes.body.job.status, 'COMPLETED');
    assert.ok(backupRes.body.job.backupReference);
    assert.ok(backupRes.body.job.verificationResult);
  });

  await t.test('Clean up server and database connections', async () => {
    await new Promise(resolve => server.close(resolve));
    await disconnectDB();
  });
});
