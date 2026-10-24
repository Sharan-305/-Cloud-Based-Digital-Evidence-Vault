const { IntegrityCheck } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');
const EvidenceService = require('./evidence.service');
const StorageService = require('./storage.service');
const CryptoService = require('./crypto.service');
const CustodyService = require('./custody.service');
const AlertService = require('./alert.service');
const AuditService = require('./audit.service');

class IntegrityService {
  /**
   * Run exact-version byte stream SHA-256 recalculation and digital signature check
   */
  static async verifyEvidenceVersion({ evidenceId, versionNumber, user, correlationId }) {
    const evidence = await EvidenceService.getEvidenceById(evidenceId);
    if (!evidence) {
      const err = new Error(`Evidence record '${evidenceId}' not found.`);
      err.status = 404;
      throw err;
    }

    const versions = await EvidenceService.getEvidenceVersions(evidenceId);
    let targetVersion;
    if (versionNumber) {
      targetVersion = versions.find(v => String(v.versionNumber) === String(versionNumber));
    } else {
      targetVersion = versions[versions.length - 1]; // current baseline version
    }

    if (!targetVersion) {
      const err = new Error(`Specified version '${versionNumber}' not found for evidence '${evidenceId}'.`);
      err.status = 404;
      throw err;
    }

    // 1. Fetch exact object version byte stream from private S3
    const s3Object = await StorageService.getObjectStream({
      key: targetVersion.s3ObjectKey,
      versionId: targetVersion.s3ObjectVersionId
    });

    // 2. Compute SHA-256 byte digest from stream
    const hash = CryptoService.createSha256Stream();
    for await (const chunk of s3Object.stream) {
      hash.update(chunk);
    }
    const calculatedSha256 = hash.digest('hex');

    // 3. Compare with protected baseline SHA-256
    const expectedSha256 = targetVersion.sha256.toLowerCase();
    const hashMatch = calculatedSha256 === expectedSha256;

    // 4. Verify canonical manifest digital signature
    const signatureValid = CryptoService.verifyManifestSignature(
      targetVersion.manifest,
      targetVersion.signature
    );

    // 5. Determine overall verdict
    let result = 'VALID';
    if (!hashMatch) {
      result = 'MISMATCH_HASH';
    } else if (!signatureValid) {
      result = 'INVALID_SIGNATURE';
    }

    // 6. Record IntegrityCheck entry
    const checkData = {
      evidenceId,
      versionNumber: targetVersion.versionNumber,
      expectedSha256,
      calculatedSha256,
      hashMatch,
      signatureValid,
      checkedBy: user._id || user.id,
      checkedAt: new Date(),
      result,
      correlationId: correlationId || `corr-verify-${Date.now()}`
    };

    let savedCheck;
    if (isMemoryMode()) {
      const store = getMemoryStore('integritychecks');
      const id = `chk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      savedCheck = { _id: id, id, ...checkData };
      store.set(id, savedCheck);
    } else {
      savedCheck = await IntegrityCheck.create(checkData);
    }

    // 7. Update Chain of Custody
    if (result === 'VALID') {
      await CustodyService.recordEvent({
        evidenceId,
        versionNumber: targetVersion.versionNumber,
        actorId: user._id || user.id,
        action: 'VERIFY_HASH_SUCCESS',
        result: 'SUCCESS',
        reason: 'Exact-version byte recalculation matched baseline SHA-256 and verified Ed25519 signature.',
        correlationId,
        safeMetadata: { calculatedSha256, expectedSha256 }
      });
    } else {
      await CustodyService.recordEvent({
        evidenceId,
        versionNumber: targetVersion.versionNumber,
        actorId: user._id || user.id,
        action: 'VERIFY_HASH_MISMATCH',
        result: 'TAMPER_DETECTED',
        reason: `Cryptographic verification failed: ${result}`,
        correlationId,
        safeMetadata: { calculatedSha256, expectedSha256, signatureValid }
      });

      // 8. Trigger Tamper Alert
      if (!hashMatch) {
        await AlertService.createAlert({
          evidenceId,
          alertType: 'HASH_MISMATCH',
          severity: 'CRITICAL',
          description: `Cryptographic digest mismatch detected for evidence ${evidenceId} (v${targetVersion.versionNumber}). Baseline: ${expectedSha256}, Recalculated: ${calculatedSha256}`,
          correlationId
        });
      }

      if (!signatureValid) {
        await AlertService.createAlert({
          evidenceId,
          alertType: 'SIGNATURE_FAIL',
          severity: 'HIGH',
          description: `Digital signature verification failed for evidence ${evidenceId} (v${targetVersion.versionNumber}) manifest.`,
          correlationId
        });
      }
    }

    // 9. Record audit event
    await AuditService.log({
      actorId: user._id || user.id,
      action: 'INTEGRITY_VERIFICATION_PERFORMED',
      targetType: 'EVIDENCE',
      targetId: evidenceId,
      result: result === 'VALID' ? 'SUCCESS' : 'TAMPER_DETECTED',
      correlationId,
      safeContext: {
        versionNumber: targetVersion.versionNumber,
        result,
        hashMatch,
        signatureValid
      }
    });

    return {
      evidenceId,
      versionNumber: targetVersion.versionNumber,
      expectedSha256,
      calculatedSha256,
      hashMatch,
      signatureValid,
      signatureAlgorithm: targetVersion.signatureAlgorithm,
      signingKeyId: targetVersion.signingKeyId,
      result,
      checkedAt: checkData.checkedAt,
      correlationId: checkData.correlationId
    };
  }

  /**
   * Get past integrity checks for an evidence record
   */
  static async getIntegrityCheckHistory(evidenceId) {
    if (isMemoryMode()) {
      const store = getMemoryStore('integritychecks');
      return Array.from(store.values())
        .filter(c => c.evidenceId === evidenceId)
        .sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt));
    }

    return IntegrityCheck.find({ evidenceId })
      .populate('checkedBy', 'email role')
      .sort({ checkedAt: -1 })
      .lean();
  }
}

module.exports = IntegrityService;
