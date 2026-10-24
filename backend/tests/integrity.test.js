process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const crypto = require('crypto');
const app = require('../src/app');
const { connectDB, disconnectDB, clearMemoryStore } = require('../src/config/database');
const UserService = require('../src/services/user.service');
const StorageService = require('../src/services/storage.service');
const EvidenceService = require('../src/services/evidence.service');
const { generateTOTP } = require('../src/utils/totp');
const bcrypt = require('bcryptjs');

test('Phase 4: Cryptographic Integrity Verification & Chain of Custody Suite', async (t) => {
  let server;
  let testPort;
  let adminToken;
  let investigatorToken;
  let auditorToken;
  let evidenceRecord;
  let versionRecord;
  let raisedAlertId;

  await t.test('Initialize database & start HTTP server', async () => {
    await connectDB();
    clearMemoryStore();
    StorageService.clearMockStorage();

    const { User, Evidence, EvidenceVersion, CustodyEvent, IntegrityCheck, Alert, AuditLog } = require('../src/models');
    try {
      await User.deleteMany({ email: { $in: ['admin4@demo.vault', 'inv4@demo.vault', 'aud4@demo.vault'] } });
      await Evidence.deleteMany({});
      await EvidenceVersion.deleteMany({});
      await CustodyEvent.deleteMany({});
      await IntegrityCheck.deleteMany({});
      await Alert.deleteMany({});
      await AuditLog.deleteMany({});
    } catch (e) {}

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        testPort = server.address().port;
        resolve();
      });
    });

    // Create users for Admin, Investigator, and Auditor
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePass2026!', salt);

    const admin = await UserService.create({
      email: 'admin4@demo.vault',
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });

    const inv = await UserService.create({
      email: 'inv4@demo.vault',
      passwordHash,
      role: 'investigator',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });

    const aud = await UserService.create({
      email: 'aud4@demo.vault',
      passwordHash,
      role: 'auditor',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });

    // Helper to log in and get session token
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

    adminToken = await getSessionToken('admin4@demo.vault');
    investigatorToken = await getSessionToken('inv4@demo.vault');
    auditorToken = await getSessionToken('aud4@demo.vault');

    // Ingest a baseline evidence item
    const pdfBytes = Buffer.from('%PDF-1.7\nIntegrity Verification Test Document\n%%EOF');
    const intake = await EvidenceService.ingestEvidence({
      title: 'Disk Image Integrity Specimen',
      category: 'forensic_archive',
      referenceId: 'CASE-INT-001',
      classification: 'restricted',
      tags: ['forensics', 'disk'],
      fileBuffer: pdfBytes,
      originalFilename: 'disk_specimen.pdf',
      detectedMimeType: 'application/pdf',
      user: inv,
      correlationId: 'corr-seed-intake'
    });

    evidenceRecord = intake.evidence;
    versionRecord = intake.version;
  });

  await t.test('POST /api/evidence/:id/verify on untouched bytes returns VALID with signature verified', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${evidenceRecord.evidenceId}/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ versionNumber: 1 })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.report.result, 'VALID');
    assert.strictEqual(body.report.hashMatch, true);
    assert.strictEqual(body.report.signatureValid, true);
    assert.strictEqual(body.report.expectedSha256, versionRecord.sha256);
    assert.strictEqual(body.report.calculatedSha256, versionRecord.sha256);
  });

  await t.test('Byte tampering in storage triggers MISMATCH_HASH, CRITICAL alert, and never overwrites baseline', async () => {
    // 1. Deliberately tamper with the stored object bytes in mock storage
    const tamperedBytes = Buffer.from('%PDF-1.7\nTAMPERED MALICIOUS CONTENT CORRUPTED\n%%EOF');
    StorageService.tamperObjectVersion({
      key: versionRecord.s3ObjectKey,
      versionId: versionRecord.s3ObjectVersionId,
      buffer: tamperedBytes
    });

    // 2. Run on-demand verification
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${evidenceRecord.evidenceId}/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auditorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ versionNumber: 1 })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.report.result, 'MISMATCH_HASH');
    assert.strictEqual(body.report.hashMatch, false);
    assert.notStrictEqual(body.report.calculatedSha256, body.report.expectedSha256);

    // 3. Verify baseline SHA-256 remains strictly unchanged in database
    const versions = await EvidenceService.getEvidenceVersions(evidenceRecord.evidenceId);
    assert.strictEqual(versions[0].sha256, versionRecord.sha256);

    // 4. Verify a CRITICAL alert was raised
    const alertRes = await fetch(`http://127.0.0.1:${testPort}/api/alerts?severity=CRITICAL`, {
      headers: { 'Authorization': `Bearer ${auditorToken}` }
    });
    assert.strictEqual(alertRes.status, 200);
    const alertBody = await alertRes.json();
    assert.strictEqual(alertBody.total >= 1, true);
    assert.strictEqual(alertBody.alerts[0].alertType, 'HASH_MISMATCH');
    assert.strictEqual(alertBody.alerts[0].status, 'OPEN');
    raisedAlertId = alertBody.alerts[0]._id || alertBody.alerts[0].id;
  });

  await t.test('Non-admin cannot resolve tamper alerts', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/alerts/${raisedAlertId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resolutionNotes: 'Attempted resolution by unauthorized role' })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN_ROLE');
  });

  await t.test('Administrator resolves tamper alert with resolution notes', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/alerts/${raisedAlertId}/resolve`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ resolutionNotes: 'Investigated bit-rot simulation; confirmed quarantine procedure.' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.alert.status, 'RESOLVED');
    assert.ok(body.alert.resolutionNotes.includes('Investigated'));
  });

  await t.test('GET /api/evidence/:id/custody returns complete immutable timeline', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${evidenceRecord.evidenceId}/custody`, {
      headers: { 'Authorization': `Bearer ${auditorToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.evidenceId, evidenceRecord.evidenceId);
    assert.strictEqual(Array.isArray(body.timeline), true);

    const actions = body.timeline.map(e => e.action);
    assert.ok(actions.includes('INTAKE_STORED'));
    assert.ok(actions.includes('VERIFY_HASH_SUCCESS'));
    assert.ok(actions.includes('VERIFY_HASH_MISMATCH'));
  });

  await t.test('GET /api/evidence/:id/integrity-history returns verification runs', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${evidenceRecord.evidenceId}/integrity-history`, {
      headers: { 'Authorization': `Bearer ${auditorToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.history.length >= 2, true);
  });

  await t.test('Auditor and Administrator can view audit logs, but Investigator is denied', async () => {
    // Investigator denied
    const invRes = await fetch(`http://127.0.0.1:${testPort}/api/audit-logs`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(invRes.status, 403);

    // Auditor permitted
    const audRes = await fetch(`http://127.0.0.1:${testPort}/api/audit-logs`, {
      headers: { 'Authorization': `Bearer ${auditorToken}` }
    });
    assert.strictEqual(audRes.status, 200);
    const audBody = await audRes.json();
    assert.strictEqual(Array.isArray(audBody.logs), true);
    assert.strictEqual(audBody.total >= 1, true);

    // Admin permitted
    const adminRes = await fetch(`http://127.0.0.1:${testPort}/api/audit-logs`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRes.status, 200);
  });

  await t.test('Close test HTTP server and disconnect DB', async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });
});
