const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
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
    required: true,
    index: true
  },
  targetType: {
    type: String,
    enum: ['USER', 'EVIDENCE', 'VERSION', 'ACCESS_REQUEST', 'ALERT', 'BACKUP', 'SYSTEM'],
    required: true
  },
  targetId: {
    type: String,
    default: null,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  result: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'DENIED'],
    required: true
  },
  correlationId: {
    type: String,
    required: true
  },
  safeContext: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  // Append-only audit records
  timestamps: { createdAt: true, updatedAt: false }
});

AuditLogSchema.index({ timestamp: -1, action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
