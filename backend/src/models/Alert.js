const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    default: null,
    index: true
  },
  alertType: {
    type: String,
    enum: [
      'HASH_MISMATCH',
      'SIGNATURE_FAIL',
      'UNAUTHORIZED_ACCESS',
      'INTEGRITY_VIOLATION',
      'ACCOUNT_LOCKOUT',
      'SUSPICIOUS_ACTIVITY'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'],
    default: 'OPEN',
    index: true
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  resolutionNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

AlertSchema.index({ status: 1, severity: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
