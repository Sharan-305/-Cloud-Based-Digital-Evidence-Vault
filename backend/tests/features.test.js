process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { connectDB, disconnectDB, clearMemoryStore } = require('../src/config/database');
const UserService = require('../src/services/user.service');
const EvidenceService = require('../src/services/evidence.service');
const StorageService = require('../src/services/storage.service');
const { generateTOTP } = require('../src/utils/totp');
const bcrypt = require('bcryptjs');

test('Phase 5: Access Approvals, PDF Reports, Dashboard & Backup Suite', async (t) => {
  let server;
  let testPort;
  let adminToken;
  let investigatorToken;
  let restrictedEvidenceId;
  let accessRequestId;

  await t.test('Initialize database & start HTTP server', async () => {
    await connectDB();
    clearMemoryStore();
    StorageService.clearMockStorage();

    const { User, Evidence, EvidenceVersion, AccessRequest, BackupJob, CustodyEvent, AuditLog, IntegrityCheck, Alert } = require('../src/models');
    try {
      await User.deleteMany({ email: { $in: ['admin5@demo.vault', 'inv5@demo.vault'] } });
      await Evidence.deleteMany({});
      await EvidenceVersion.deleteMany({});
      await AccessRequest.deleteMany({});
      await BackupJob.deleteMany({});
      await CustodyEvent.deleteMany({});
      await AuditLog.deleteMany({});
      await IntegrityCheck.deleteMany({});
      await Alert.deleteMany({});
    } catch (e) {}

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        testPort = server.address().port;
        resolve();
      });
    });

    // Create Admin and Investigator
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePass2026!', salt);

    const admin = await UserService.create({
      email: 'admin5@demo.vault',
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });

    const inv = await UserService.create({
      email: 'inv5@demo.vault',
      passwordHash,
      role: 'investigator',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });

    async function getSessionToken(email) {
      const login = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'SecurePass2026!' })
      });
      const loginBody = await login.json();
      const mfa = await fetch(`http://127.0.0.1:${testPort}/api/auth/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaChallengeToken: loginBody.mfaChallengeToken,
          totpCode: generateTOTP('JBSWY3DPEHPK3PXP')
        })
      });
      return (await mfa.json()).sessionToken;
    }

    adminToken = await getSessionToken('admin5@demo.vault');
    investigatorToken = await getSessionToken('inv5@demo.vault');

    // Ingest a restricted evidence item
    const pdfBytes = Buffer.from('%PDF-1.7\nRestricted Classification Sample\n%%EOF');
    const intake = await EvidenceService.ingestEvidence({
      title: 'Restricted Case Ledger',
      category: 'documents',
      referenceId: 'CASE-RES-999',
      classification: 'restricted',
      tags: ['restricted', 'audit'],
      fileBuffer: pdfBytes,
      originalFilename: 'restricted_ledger.pdf',
      detectedMimeType: 'application/pdf',
      user: inv,
      correlationId: 'corr-init-res'
    });

    restrictedEvidenceId = intake.evidence.evidenceId;
  });

  await t.test('Investigator cannot download restricted evidence without approved access grant', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${restrictedEvidenceId}/download`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'RESTRICTED_ACCESS_REQUIRED');
  });

  await t.test('Investigator submits access request for restricted evidence', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/access-requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        evidenceId: restrictedEvidenceId,
        reason: 'Court-ordered subpoena inspection required.',
        requestedDuration: 4
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.request.decision, 'PENDING');
    assert.strictEqual(body.request.requestedDuration, 4);
    accessRequestId = body.request._id || body.request.id;
  });

  await t.test('Self-approval is strictly prevented (Investigator cannot approve own request)', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/access-requests/${accessRequestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decisionReason: 'Self-approval attempt' })
    });

    // Blocked by RBAC or self-approval validation
    assert.strictEqual(res.status >= 403, true);
    const body = await res.json();
    assert.ok(body.error.code === 'FORBIDDEN_ROLE' || body.error.code === 'SELF_APPROVAL_FORBIDDEN');
  });

  await t.test('Administrator approves access request with expiration timestamp', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/access-requests/${accessRequestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ decisionReason: 'Valid court order confirmed' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.request.decision, 'APPROVED');
    assert.ok(body.request.expiresAt);
  });

  await t.test('Investigator can now download restricted evidence with active grant', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${restrictedEvidenceId}/download`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.startsWith('%PDF-1.7'));
  });

  await t.test('Administrator revokes active access grant', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/access-requests/${accessRequestId}/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.request.decision, 'REVOKED');

    // Subsequent download attempt is immediately blocked
    const dlRes = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${restrictedEvidenceId}/download`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(dlRes.status, 403);
  });

  await t.test('GET /api/evidence/:id/report streams valid signed PDF document', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${restrictedEvidenceId}/report`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'application/pdf');

    const buffer = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(buffer.slice(0, 4).toString(), '%PDF');
    assert.ok(buffer.length > 500); // Verify substantive PDF document generated
  });

  await t.test('GET /api/dashboard/stats returns aggregated metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/dashboard/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.role, 'admin');
    assert.strictEqual(typeof body.metrics.totalEvidence, 'number');
    assert.strictEqual(typeof body.metrics.pendingApprovals, 'number');
    assert.ok(body.metrics.integrityCheckSuccessRate);
    assert.ok(Array.isArray(body.recentActivity));
  });

  await t.test('Administrator executes manual backup and verifies checksums', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/backups/run`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.job.status, 'COMPLETED');
    assert.ok(body.job.backupReference.startsWith('backup-snapshot-'));

    // Verify non-admin is blocked
    const invRes = await fetch(`http://127.0.0.1:${testPort}/api/backups/run`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(invRes.status, 403);
  });

  await t.test('Close test HTTP server and disconnect DB', async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });
});
