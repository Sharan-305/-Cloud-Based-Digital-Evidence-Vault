const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },
  role: {
    type: String,
    enum: ['admin', 'investigator', 'auditor'],
    default: 'investigator'
  },
  accountStatus: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'disabled'],
    default: 'pending' // Pending admin approval per master prompt
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationTokenHash: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  passwordResetTokenHash: {
    type: String,
    default: null
  },
  passwordResetExpires: {
    type: Date,
    default: null
  },
  mfaEnabled: {
    type: Boolean,
    default: false
  },
  mfaSecret: {
    type: String,
    default: null
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
UserSchema.index({ accountStatus: 1 });
UserSchema.index({ role: 1 });

/**
 * Compare plain password against stored bcrypt hash
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Return safe object without sensitive secrets
 */
UserSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.mfaSecret;
  delete obj.emailVerificationTokenHash;
  delete obj.passwordResetTokenHash;
  return obj;
};

// Static helper to hash passwords
UserSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
};

module.exports = mongoose.model('User', UserSchema);
