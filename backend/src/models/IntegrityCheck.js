const mongoose = require('mongoose');

const IntegrityCheckSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  expectedSha256: {
    type: String,
    required: true,
    length: 64
  },
  calculatedSha256: {
    type: String,
    required: true,
    length: 64
  },
  hashMatch: {
    type: Boolean,
    required: true
  },
  signatureValid: {
    type: Boolean,
    required: true
  },
  checkedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  checkedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  result: {
    type: String,
    enum: ['VALID', 'MISMATCH_HASH', 'INVALID_SIGNATURE', 'ERROR'],
    required: true
  },
  correlationId: {
    type: String,
    required: true
  }
});

IntegrityCheckSchema.index({ evidenceId: 1, checkedAt: -1 });

module.exports = mongoose.model('IntegrityCheck', IntegrityCheckSchema);
