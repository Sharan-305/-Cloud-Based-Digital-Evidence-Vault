const mongoose = require('mongoose');

const EvidenceSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  title: {
    type: String,
    required: [true, 'Evidence title is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  category: {
    type: String,
    enum: ['documents', 'images', 'video', 'logs', 'forensic_archive', 'other'],
    required: true
  },
  referenceId: {
    type: String,
    required: [true, 'Reference/Case ID is required'],
    trim: true
  },
  tags: {
    type: [String],
    default: []
  },
  classification: {
    type: String,
    enum: ['public', 'internal', 'confidential', 'restricted'],
    default: 'confidential'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  currentVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvidenceVersion',
    default: null
  },
  status: {
    type: String,
    enum: ['intake_pending', 'active', 'archived', 'disposed'],
    default: 'intake_pending'
  }
}, {
  timestamps: true
});

EvidenceSchema.index({ referenceId: 1 });
EvidenceSchema.index({ tags: 1 });
EvidenceSchema.index({ status: 1 });
EvidenceSchema.index({ category: 1 });
EvidenceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Evidence', EvidenceSchema);
