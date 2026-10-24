const mongoose = require('mongoose');

const EvidenceVersionSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true,
    min: 1
  },
  s3Bucket: {
    type: String,
    required: true
  },
  s3ObjectKey: {
    type: String,
    required: true
  },
  s3ObjectVersionId: {
    type: String,
    required: true
  },
  originalFilename: {
    type: String,
    required: true
  },
  detectedMimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true,
    min: 0
  },
  hashAlgorithm: {
    type: String,
    default: 'SHA-256'
  },
  sha256: {
    type: String,
    required: true,
    lowercase: true,
    length: 64
  },
  manifest: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  signature: {
    type: String,
    required: true
  },
  signatureAlgorithm: {
    type: String,
    default: 'Ed25519'
  },
  signingKeyId: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

EvidenceVersionSchema.index({ evidenceId: 1, versionNumber: 1 }, { unique: true });
EvidenceVersionSchema.index({ s3ObjectKey: 1, s3ObjectVersionId: 1 });
EvidenceVersionSchema.index({ sha256: 1 });

module.exports = mongoose.model('EvidenceVersion', EvidenceVersionSchema);
