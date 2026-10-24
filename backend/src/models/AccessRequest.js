const mongoose = require('mongoose');

const AccessRequestSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    index: true
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  reason: {
    type: String,
    required: [true, 'Operational reason is required'],
    trim: true
  },
  requestedDuration: {
    type: Number, // in hours
    required: true,
    min: 1,
    max: 72
  },
  decision: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED'],
    default: 'PENDING',
    index: true
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  decisionReason: {
    type: String,
    default: ''
  },
  decidedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

AccessRequestSchema.index({ evidenceId: 1, requesterId: 1, decision: 1 });

module.exports = mongoose.model('AccessRequest', AccessRequestSchema);
