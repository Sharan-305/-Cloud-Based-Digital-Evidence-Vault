const mongoose = require('mongoose');

const BackupJobSchema = new mongoose.Schema({
  jobType: {
    type: String,
    enum: ['SCHEDULED', 'MANUAL'],
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['RUNNING', 'COMPLETED', 'FAILED'],
    default: 'RUNNING'
  },
  backupReference: {
    type: String,
    default: null
  },
  verificationResult: {
    type: String,
    default: null
  },
  safeErrorSummary: {
    type: String,
    default: null
  }
});

BackupJobSchema.index({ startedAt: -1, status: 1 });

module.exports = mongoose.model('BackupJob', BackupJobSchema);
