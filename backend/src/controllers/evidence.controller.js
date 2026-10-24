const busboy = require('busboy');
const EvidenceService = require('../services/evidence.service');
const StorageService = require('../services/storage.service');
const AuditService = require('../services/audit.service');

/**
 * Helper to parse multipart file upload using busboy streaming
 */
function parseMultipartUpload(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: 524288000, // 500 MB
          files: 1
        }
      });
    } catch (err) {
      return reject(new Error('Invalid multipart request headers'));
    }

    const fields = {};
    const fileChunks = [];
    let fileInfo = null;

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (name, fileStream, info) => {
      fileInfo = info;
      fileStream.on('data', (chunk) => {
        fileChunks.push(chunk);
      });
      fileStream.on('error', (err) => {
        reject(err);
      });
    });

    bb.on('finish', () => {
      if (!fileInfo || fileChunks.length === 0) {
        return reject(new Error('No evidence file was uploaded.'));
      }

      const fileBuffer = Buffer.concat(fileChunks);
      resolve({
        fields,
        fileBuffer,
        filename: fileInfo.filename,
        mimeType: fileInfo.mimeType
      });
    });

    bb.on('error', (err) => {
      reject(err);
    });

    req.pipe(bb);
  });
}

/**
 * List evidence
 */
async function listEvidence(req, res, next) {
  try {
    const { query, category, status, page, limit } = req.query;
    const result = await EvidenceService.listEvidence({
      query,
      category,
      status,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10)
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Intake new evidence record and file
 */
async function createEvidence(req, res, next) {
  try {
    const { fields, fileBuffer, filename, mimeType } = await parseMultipartUpload(req);

    const { title, category, referenceId, classification, description, tags } = fields;

    if (!title || !category || !referenceId) {
      return res.status(400).json({
        error: {
          message: 'Title, category, and referenceId are required fields.',
          code: 'MISSING_FIELDS',
          correlationId: req.correlationId
        }
      });
    }

    const parsedTags = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const result = await EvidenceService.ingestEvidence({
      title,
      description: description || '',
      category,
      referenceId,
      tags: parsedTags,
      classification: classification || 'confidential',
      fileBuffer,
      originalFilename: filename,
      detectedMimeType: mimeType,
      user: req.user,
      correlationId: req.correlationId
    });

    res.status(201).json({
      message: 'Evidence successfully ingested into private vault.',
      evidence: result.evidence,
      version: result.version,
      state: result.state
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get evidence by ID
 */
async function getEvidenceById(req, res, next) {
  try {
    const { evidenceId } = req.params;
    const evidence = await EvidenceService.getEvidenceById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        error: {
          message: `Evidence with ID '${evidenceId}' not found.`,
          code: 'EVIDENCE_NOT_FOUND',
          correlationId: req.correlationId
        }
      });
    }

    res.status(200).json({ evidence });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all versions of an evidence record
 */
async function getEvidenceVersions(req, res, next) {
  try {
    const { evidenceId } = req.params;
    const versions = await EvidenceService.getEvidenceVersions(evidenceId);
    res.status(200).json({ evidenceId, versions });
  } catch (err) {
    next(err);
  }
}

/**
 * Upload a new version to an existing evidence record
 */
async function createEvidenceVersion(req, res, next) {
  try {
    const { evidenceId } = req.params;
    const { fileBuffer, filename, mimeType } = await parseMultipartUpload(req);

    const version = await EvidenceService.addVersion({
      evidenceId,
      fileBuffer,
      originalFilename: filename,
      detectedMimeType: mimeType,
      user: req.user,
      correlationId: req.correlationId
    });

    res.status(201).json({
      message: `Version v${version.versionNumber} successfully added.`,
      version
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Secure download: checks authorization and provides short-lived signed URL or proxy stream
 */
async function downloadEvidence(req, res, next) {
  try {
    const { evidenceId } = req.params;
    const { versionNumber } = req.query;

    const evidence = await EvidenceService.getEvidenceById(evidenceId);
    if (!evidence) {
      return res.status(404).json({
        error: {
          message: 'Evidence record not found.',
          code: 'EVIDENCE_NOT_FOUND',
          correlationId: req.correlationId
        }
      });
    }

    // Role check: Auditors cannot download raw files by default
    if (req.user.role === 'auditor') {
      return res.status(403).json({
        error: {
          message: 'Auditor role is read-only for metadata and custody history. Raw evidence download denied.',
          code: 'AUDITOR_DOWNLOAD_DENIED',
          correlationId: req.correlationId
        }
      });
    }

    const versions = await EvidenceService.getEvidenceVersions(evidenceId);
    let targetVersion;
    if (versionNumber) {
      targetVersion = versions.find(v => String(v.versionNumber) === String(versionNumber));
    } else {
      targetVersion = versions[versions.length - 1]; // current
    }

    if (!targetVersion) {
      return res.status(404).json({
        error: {
          message: 'Specified evidence version not found.',
          code: 'VERSION_NOT_FOUND',
          correlationId: req.correlationId
        }
      });
    }

    // Stream download directly from storage
    const obj = await StorageService.getObjectStream({
      key: targetVersion.s3ObjectKey,
      versionId: targetVersion.s3ObjectVersionId
    });

    res.setHeader('Content-Type', obj.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${targetVersion.originalFilename}"`);

    await AuditService.log({
      actorId: req.user._id || req.user.id,
      action: 'EVIDENCE_DOWNLOAD_STREAMED',
      targetType: 'EVIDENCE',
      targetId: evidenceId,
      result: 'SUCCESS',
      correlationId: req.correlationId,
      safeContext: { versionNumber: targetVersion.versionNumber, filename: targetVersion.originalFilename }
    });

    obj.stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listEvidence,
  createEvidence,
  getEvidenceById,
  getEvidenceVersions,
  createEvidenceVersion,
  downloadEvidence
};
