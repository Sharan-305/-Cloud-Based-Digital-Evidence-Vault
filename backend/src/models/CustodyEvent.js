const mongoose = require('mongoose');

const CustodyEventSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    index: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  systemActor: {
    type: String,
    default: null
  },
  action: {
    type: String,
    enum: [
      'INTAKE_STORED',
      'MANIFEST_SIGNED',
      'VIEW_METADATA',
      'DOWNLOAD_AUTHORIZED',
      'DOWNLOAD_ATTEMPT_DENIED',
      'VERIFY_HASH_SUCCESS',
      'VERIFY_HASH_MISMATCH',
      'VERSION_ADDED',
      'REPORT_GENERATED',
      'RETENTION_HELD',
      'RECOVERY_RESTORED'
    ],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  result: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'TAMPER_DETECTED', 'DENIED'],
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  correlationId: {
    type: String,
    required: true,
    index: true
  },
  safeMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  // Chain of custody is strictly append-only
  timestamps: { createdAt: true, updatedAt: false }
});

CustodyEventSchema.index({ evidenceId: 1, timestamp: -1 });

module.exports = mongoose.model('CustodyEvent', CustodyEventSchema);
