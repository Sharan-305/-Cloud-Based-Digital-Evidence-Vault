process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const crypto = require('crypto');
const app = require('../src/app');
const { connectDB, disconnectDB, clearMemoryStore } = require('../src/config/database');
const UserService = require('../src/services/user.service');
const StorageService = require('../src/services/storage.service');
const CryptoService = require('../src/services/crypto.service');
const { generateTOTP } = require('../src/utils/totp');
const bcrypt = require('bcryptjs');

test('Phase 3: Private S3 Storage & Upload State Machine Verification Suite', async (t) => {
  let server;
  let testPort;
  let investigatorToken;
  let auditorToken;
  let createdEvidenceId;

  // Helper to create multipart body
  function createMultipartBody(fields, file) {
    const boundary = '----VaultBoundary' + Math.random().toString(36).substr(2);
    const chunks = [];

    for (const [key, val] of Object.entries(fields)) {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
    }

    if (file) {
      chunks.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`
      ));
      chunks.push(file.content);
      chunks.push(Buffer.from('\r\n'));
    }

    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);
    return { body, contentType: `multipart/form-data; boundary=${boundary}` };
  }

  await t.test('Initialize database & start HTTP server', async () => {
    await connectDB();
    clearMemoryStore();
    StorageService.clearMockStorage();

    const { User, Evidence, EvidenceVersion, CustodyEvent, AuditLog } = require('../src/models');
    try {
      await User.deleteMany({ email: { $in: ['inv3@demo.vault', 'aud3@demo.vault'] } });
      await Evidence.deleteMany({});
      await EvidenceVersion.deleteMany({});
      await CustodyEvent.deleteMany({});
      await AuditLog.deleteMany({});
    } catch (e) {}

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        testPort = server.address().port;
        resolve();
      });
    });

    // Create active Investigator & Auditor
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePass2026!', salt);

    await UserService.create({
      email: 'inv3@demo.vault',
      passwordHash,
      role: 'investigator',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });

    await UserService.create({
      email: 'aud3@demo.vault',
      passwordHash,
      role: 'auditor',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });

    // Login Investigator
    const invLogin = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inv3@demo.vault', password: 'SecurePass2026!' })
    });
    const invLoginBody = await invLogin.json();
    const invMfa = await fetch(`http://127.0.0.1:${testPort}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaChallengeToken: invLoginBody.mfaChallengeToken,
        totpCode: generateTOTP('JBSWY3DPEHPK3PXP')
      })
    });
    investigatorToken = (await invMfa.json()).sessionToken;

    // Login Auditor
    const audLogin = await fetch(`http://127.0.0.1:${testPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aud3@demo.vault', password: 'SecurePass2026!' })
    });
    const audLoginBody = await audLogin.json();
    const audMfa = await fetch(`http://127.0.0.1:${testPort}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaChallengeToken: audLoginBody.mfaChallengeToken,
        totpCode: generateTOTP('JBSWY3DPEHPK3PXP')
      })
    });
    auditorToken = (await audMfa.json()).sessionToken;
  });

  await t.test('Rejects upload with prohibited file extension', async () => {
    const { body, contentType } = createMultipartBody(
      { title: 'Malware binary', category: 'logs', referenceId: 'CASE-001' },
      { filename: 'payload.exe', mimeType: 'application/x-msdownload', content: Buffer.from('MZtestbinary') }
    );

    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': contentType
      },
      body
    });

    assert.strictEqual(res.status, 500);
    const resBody = await res.json();
    assert.ok(resBody.error.message.includes('not permitted'));
  });

  await t.test('Rejects upload when file signature mismatches extension', async () => {
    const { body, contentType } = createMultipartBody(
      { title: 'Corrupt PDF', category: 'documents', referenceId: 'CASE-002' },
      { filename: 'report.pdf', mimeType: 'application/pdf', content: Buffer.from('INVALID_HEADER_NOT_PDF') }
    );

    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': contentType
      },
      body
    });

    assert.strictEqual(res.status, 500);
    const resBody = await res.json();
    assert.ok(resBody.error.message.includes('PDF document header'));
  });

  await t.test('Successful intake: state machine progresses to COMPLETE with SHA-256 and Ed25519 signature', async () => {
    // Valid PDF file header
    const pdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const expectedSha256 = crypto.createHash('sha256').update(pdfBytes).digest('hex');

    const { body, contentType } = createMultipartBody(
      {
        title: 'Forensic Network Audit Report',
        description: 'Synthetic incident memory capture report',
        category: 'documents',
        referenceId: 'CASE-2026-X01',
        classification: 'confidential',
        tags: 'network,audit,synthetic'
      },
      { filename: 'network_audit_2026.pdf', mimeType: 'application/pdf', content: pdfBytes }
    );

    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': contentType
      },
      body
    });

    assert.strictEqual(res.status, 201);
    const resBody = await res.json();
    assert.strictEqual(resBody.state, 'COMPLETE');
    assert.ok(resBody.evidence.evidenceId.startsWith('EV-'));
    assert.strictEqual(resBody.version.versionNumber, 1);
    assert.strictEqual(resBody.version.sha256, expectedSha256);
    assert.ok(resBody.version.signature);
    assert.strictEqual(resBody.version.signatureAlgorithm, 'Ed25519');
    assert.ok(resBody.version.s3ObjectKey.startsWith('evidence/'));
    assert.ok(resBody.version.s3ObjectVersionId);

    // Verify manifest digital signature with CryptoService
    const isSigValid = CryptoService.verifyManifestSignature(resBody.version.manifest, resBody.version.signature);
    assert.strictEqual(isSigValid, true);

    createdEvidenceId = resBody.evidence.evidenceId;
  });

  await t.test('Query evidence list and filter by search and category', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence?category=documents&query=Network`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.total >= 1, true);
    assert.strictEqual(body.evidence[0].evidenceId, createdEvidenceId);
  });

  await t.test('Add second version (v2) to existing evidence without overwriting v1', async () => {
    const updatedPdfBytes = Buffer.from('%PDF-1.7\n2 0 obj\n<<UpdatedVersion>>\nendobj\n%%EOF');
    const v2ExpectedHash = crypto.createHash('sha256').update(updatedPdfBytes).digest('hex');

    const { body, contentType } = createMultipartBody(
      {},
      { filename: 'network_audit_2026_v2.pdf', mimeType: 'application/pdf', content: updatedPdfBytes }
    );

    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${createdEvidenceId}/versions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${investigatorToken}`,
        'Content-Type': contentType
      },
      body
    });

    assert.strictEqual(res.status, 201);
    const resBody = await res.json();
    assert.strictEqual(resBody.version.versionNumber, 2);
    assert.strictEqual(resBody.version.sha256, v2ExpectedHash);

    // Fetch version history
    const verRes = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${createdEvidenceId}/versions`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(verRes.status, 200);
    const verBody = await verRes.json();
    assert.strictEqual(verBody.versions.length, 2);
    assert.strictEqual(verBody.versions[0].versionNumber, 1);
    assert.strictEqual(verBody.versions[1].versionNumber, 2);
  });

  await t.test('Auditor cannot download raw evidence files (read-only enforcement)', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${createdEvidenceId}/download`, {
      headers: { 'Authorization': `Bearer ${auditorToken}` }
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'AUDITOR_DOWNLOAD_DENIED');
  });

  await t.test('Investigator streams authorized download bytes', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/evidence/${createdEvidenceId}/download?versionNumber=1`, {
      headers: { 'Authorization': `Bearer ${investigatorToken}` }
    });
    assert.strictEqual(res.status, 200);
    const downloadedText = await res.text();
    assert.ok(downloadedText.startsWith('%PDF-1.7'));
  });

  await t.test('Close test HTTP server and disconnect DB', async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });
});
