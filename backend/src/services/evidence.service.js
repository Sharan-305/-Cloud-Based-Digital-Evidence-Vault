const crypto = require('crypto');
const path = require('path');
const { Evidence, EvidenceVersion, CustodyEvent } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');
const StorageService = require('./storage.service');
const CryptoService = require('./crypto.service');
const AuditService = require('./audit.service');
const { validateFileHeader } = require('../utils/fileValidator');
const config = require('../config');

class EvidenceService {
  /**
   * Generate next sequential Evidence ID (e.g. EV-2026-0001)
   */
  static async generateEvidenceId() {
    const year = new Date().getFullYear();
    const prefix = `EV-${year}-`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${randomSuffix}`;
  }

  /**
   * Ingest new evidence with Upload State Machine
   * State Machine: INITIATED -> OBJECT_STORED -> HASHED -> METADATA_COMMITTED -> COMPLETE
   */
  static async ingestEvidence({
    title,
    description = '',
    category,
    referenceId,
    tags = [],
    classification = 'confidential',
    fileBuffer,
    originalFilename,
    detectedMimeType,
    user,
    correlationId
  }) {
    let state = 'INITIATED';
    let storedS3Info = null;
    const evidenceId = await this.generateEvidenceId();

    try {
      // 1. INITIATED: Header, extension, and magic number check
      validateFileHeader(originalFilename, detectedMimeType, fileBuffer.slice(0, 16));

      // 2. Compute SHA-256 hash
      const sha256 = CryptoService.hashSha256(fileBuffer);
      const fileSize = fileBuffer.length;
      state = 'HASHED';

      // 3. OBJECT_STORED: Upload bytes to private S3 with safe unique object key
      const safeKey = `evidence/${evidenceId}/v1/${crypto.randomBytes(12).toString('hex')}${path.extname(originalFilename)}`;
      storedS3Info = await StorageService.putObject({
        key: safeKey,
        buffer: fileBuffer,
        contentType: detectedMimeType || 'application/octet-stream',
        metadata: {
          evidenceId,
          version: '1',
          sha256,
          originalFilename
        }
      });
      state = 'OBJECT_STORED';

      // 4. METADATA_COMMITTED: Build canonical manifest and sign
      const manifest = CryptoService.buildManifest({
        evidenceId,
        versionNumber: 1,
        s3Bucket: storedS3Info.bucket,
        s3ObjectKey: storedS3Info.key,
        s3ObjectVersionId: storedS3Info.versionId,
        sha256,
        fileSize,
        originalFilename,
        detectedMimeType,
        timestamp: new Date()
      });

      const { signature, signatureAlgorithm, signingKeyId } = CryptoService.signManifest(manifest);

      let savedEvidence;
      let savedVersion;

      if (isMemoryMode()) {
        const evStore = getMemoryStore('evidence');
        const verStore = getMemoryStore('evidenceversions');
        const custStore = getMemoryStore('custodyevents');

        const verId = `ver-${Date.now()}`;
        savedVersion = {
          _id: verId,
          id: verId,
          evidenceId,
          versionNumber: 1,
          s3Bucket: storedS3Info.bucket,
          s3ObjectKey: storedS3Info.key,
          s3ObjectVersionId: storedS3Info.versionId,
          originalFilename,
          detectedMimeType,
          fileSize,
          hashAlgorithm: 'SHA-256',
          sha256,
          manifest,
          signature,
          signatureAlgorithm,
          signingKeyId,
          uploadedBy: user._id || user.id,
          uploadedAt: new Date()
        };
        verStore.set(verId, savedVersion);

        const evId = `ev-${Date.now()}`;
        savedEvidence = {
          _id: evId,
          id: evId,
          evidenceId,
          title,
          description,
          category,
          referenceId,
          tags: Array.isArray(tags) ? tags : [tags],
          classification,
          createdBy: user._id || user.id,
          currentVersionId: verId,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        evStore.set(evidenceId, savedEvidence);

        // Record custody event
        const custId = `cust-${Date.now()}`;
        const custodyEvent = {
          _id: custId,
          evidenceId,
          versionNumber: 1,
          actorId: user._id || user.id,
          action: 'INTAKE_STORED',
          timestamp: new Date(),
          result: 'SUCCESS',
          reason: 'Initial intake and cryptographic manifest creation',
          correlationId,
          safeMetadata: { sha256, fileSize, originalFilename }
        };
        custStore.set(custId, custodyEvent);
      } else {
        // Mongoose database commit
        savedVersion = await EvidenceVersion.create({
          evidenceId,
          versionNumber: 1,
          s3Bucket: storedS3Info.bucket,
          s3ObjectKey: storedS3Info.key,
          s3ObjectVersionId: storedS3Info.versionId,
          originalFilename,
          detectedMimeType,
          fileSize,
          hashAlgorithm: 'SHA-256',
          sha256,
          manifest,
          signature,
          signatureAlgorithm,
          signingKeyId,
          uploadedBy: user._id || user.id
        });

        savedEvidence = await Evidence.create({
          evidenceId,
          title,
          description,
          category,
          referenceId,
          tags: Array.isArray(tags) ? tags : [tags],
          classification,
          createdBy: user._id || user.id,
          currentVersionId: savedVersion._id,
          status: 'active'
        });

        await CustodyEvent.create({
          evidenceId,
          versionNumber: 1,
          actorId: user._id || user.id,
          action: 'INTAKE_STORED',
          result: 'SUCCESS',
          reason: 'Initial intake and cryptographic manifest creation',
          correlationId,
          safeMetadata: { sha256, fileSize, originalFilename }
        });
      }

      state = 'METADATA_COMMITTED';

      // 5. COMPLETE: Audit log entry
      await AuditService.log({
        actorId: user._id || user.id,
        action: 'EVIDENCE_INTAKE_COMPLETED',
        targetType: 'EVIDENCE',
        targetId: evidenceId,
        result: 'SUCCESS',
        correlationId,
        safeContext: { evidenceId, version: 1, sha256, fileSize }
      });

      state = 'COMPLETE';

      return {
        evidence: savedEvidence,
        version: savedVersion,
        state
      };
    } catch (err) {
      console.error(`[EvidenceService] Ingestion failed at state '${state}':`, err.message);

      // Failure Compensation: rollback uploaded S3 object if error occurred after S3 put
      if (storedS3Info && (state === 'OBJECT_STORED' || state === 'HASHED')) {
        console.warn(`[EvidenceService] Executing failure compensation: deleting orphaned S3 object ${storedS3Info.key}`);
        try {
          await StorageService.deleteObjectVersion({
            key: storedS3Info.key,
            versionId: storedS3Info.versionId
          });
        } catch (cleanupErr) {
          console.error('[EvidenceService] Compensation cleanup failed:', cleanupErr.message);
        }
      }

      await AuditService.log({
        actorId: user ? (user._id || user.id) : null,
        action: 'EVIDENCE_INTAKE_FAILED',
        targetType: 'EVIDENCE',
        targetId: evidenceId,
        result: 'FAILURE',
        correlationId,
        safeContext: { failedAtState: state, error: err.message }
      });

      throw err;
    }
  }

  /**
   * Add a new version to an existing evidence record
   */
  static async addVersion({
    evidenceId,
    fileBuffer,
    originalFilename,
    detectedMimeType,
    user,
    correlationId
  }) {
    const evidence = await this.getEvidenceById(evidenceId);
    if (!evidence) {
      const err = new Error(`Evidence ${evidenceId} not found.`);
      err.status = 404;
      throw err;
    }

    validateFileHeader(originalFilename, detectedMimeType, fileBuffer.slice(0, 16));

    // Get current version count to calculate next version number
    const existingVersions = await this.getEvidenceVersions(evidenceId);
    const nextVersionNumber = existingVersions.length + 1;

    const sha256 = CryptoService.hashSha256(fileBuffer);
    const fileSize = fileBuffer.length;

    const safeKey = `evidence/${evidenceId}/v${nextVersionNumber}/${crypto.randomBytes(12).toString('hex')}${path.extname(originalFilename)}`;
    const storedS3Info = await StorageService.putObject({
      key: safeKey,
      buffer: fileBuffer,
      contentType: detectedMimeType || 'application/octet-stream',
      metadata: {
        evidenceId,
        version: String(nextVersionNumber),
        sha256,
        originalFilename
      }
    });

    const manifest = CryptoService.buildManifest({
      evidenceId,
      versionNumber: nextVersionNumber,
      s3Bucket: storedS3Info.bucket,
      s3ObjectKey: storedS3Info.key,
      s3ObjectVersionId: storedS3Info.versionId,
      sha256,
      fileSize,
      originalFilename,
      detectedMimeType,
      timestamp: new Date()
    });

    const { signature, signatureAlgorithm, signingKeyId } = CryptoService.signManifest(manifest);

    let savedVersion;

    if (isMemoryMode()) {
      const verStore = getMemoryStore('evidenceversions');
      const custStore = getMemoryStore('custodyevents');

      const verId = `ver-${Date.now()}`;
      savedVersion = {
        _id: verId,
        id: verId,
        evidenceId,
        versionNumber: nextVersionNumber,
        s3Bucket: storedS3Info.bucket,
        s3ObjectKey: storedS3Info.key,
        s3ObjectVersionId: storedS3Info.versionId,
        originalFilename,
        detectedMimeType,
        fileSize,
        hashAlgorithm: 'SHA-256',
        sha256,
        manifest,
        signature,
        signatureAlgorithm,
        signingKeyId,
        uploadedBy: user._id || user.id,
        uploadedAt: new Date()
      };
      verStore.set(verId, savedVersion);

      evidence.currentVersionId = verId;

      const custId = `cust-${Date.now()}`;
      custStore.set(custId, {
        _id: custId,
        evidenceId,
        versionNumber: nextVersionNumber,
        actorId: user._id || user.id,
        action: 'VERSION_ADDED',
        timestamp: new Date(),
        result: 'SUCCESS',
        reason: `Added new version v${nextVersionNumber}`,
        correlationId,
        safeMetadata: { sha256, fileSize, originalFilename }
      });
    } else {
      savedVersion = await EvidenceVersion.create({
        evidenceId,
        versionNumber: nextVersionNumber,
        s3Bucket: storedS3Info.bucket,
        s3ObjectKey: storedS3Info.key,
        s3ObjectVersionId: storedS3Info.versionId,
        originalFilename,
        detectedMimeType,
        fileSize,
        hashAlgorithm: 'SHA-256',
        sha256,
        manifest,
        signature,
        signatureAlgorithm,
        signingKeyId,
        uploadedBy: user._id || user.id
      });

      await Evidence.findOneAndUpdate(
        { evidenceId },
        { currentVersionId: savedVersion._id },
        { returnDocument: 'after' }
      );

      await CustodyEvent.create({
        evidenceId,
        versionNumber: nextVersionNumber,
        actorId: user._id || user.id,
        action: 'VERSION_ADDED',
        result: 'SUCCESS',
        reason: `Added new version v${nextVersionNumber}`,
        correlationId,
        safeMetadata: { sha256, fileSize, originalFilename }
      });
    }

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'EVIDENCE_VERSION_ADDED',
      targetType: 'VERSION',
      targetId: `${evidenceId}-v${nextVersionNumber}`,
      result: 'SUCCESS',
      correlationId,
      safeContext: { evidenceId, versionNumber: nextVersionNumber, sha256 }
    });

    return savedVersion;
  }

  /**
   * List evidence records with search, filter, and pagination
   */
  static async listEvidence({ query, category, status, page = 1, limit = 20 } = {}) {
    if (isMemoryMode()) {
      const store = getMemoryStore('evidence');
      let items = Array.from(store.values());

      if (category) items = items.filter(e => e.category === category);
      if (status) items = items.filter(e => e.status === status);
      if (query) {
        const q = query.toLowerCase();
        items = items.filter(e =>
          (e.evidenceId && e.evidenceId.toLowerCase().includes(q)) ||
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.referenceId && e.referenceId.toLowerCase().includes(q))
        );
      }

      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const skip = (page - 1) * limit;
      return {
        evidence: items.slice(skip, skip + limit),
        total: items.length,
        page,
        limit
      };
    }

    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (query) {
      filter.$or = [
        { evidenceId: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } },
        { referenceId: { $regex: query, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Evidence.find(filter)
        .populate('currentVersionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Evidence.countDocuments(filter)
    ]);

    return {
      evidence: items,
      total,
      page,
      limit
    };
  }

  /**
   * Get single evidence record by Evidence ID
   */
  static async getEvidenceById(evidenceId) {
    if (isMemoryMode()) {
      const store = getMemoryStore('evidence');
      return store.get(evidenceId) || null;
    }
    return Evidence.findOne({ evidenceId }).populate('currentVersionId').lean();
  }

  /**
   * Get all versions of an evidence item
   */
  static async getEvidenceVersions(evidenceId) {
    if (isMemoryMode()) {
      const store = getMemoryStore('evidenceversions');
      const items = Array.from(store.values()).filter(v => v.evidenceId === evidenceId);
      return items.sort((a, b) => a.versionNumber - b.versionNumber);
    }
    return EvidenceVersion.find({ evidenceId }).sort({ versionNumber: 1 }).lean();
  }
}

module.exports = EvidenceService;
