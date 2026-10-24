const { User } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');

class UserService {
  static async findById(id) {
    if (isMemoryMode()) {
      const store = getMemoryStore('users');
      return store.get(String(id)) || null;
    }
    return User.findById(id);
  }

  static async findByEmail(email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (isMemoryMode()) {
      const store = getMemoryStore('users');
      for (const u of store.values()) {
        if (u.email === cleanEmail) return u;
      }
      return null;
    }
    return User.findOne({ email: cleanEmail });
  }

  static async findByEmailVerificationTokenHash(tokenHash) {
    if (isMemoryMode()) {
      const store = getMemoryStore('users');
      for (const u of store.values()) {
        if (u.emailVerificationTokenHash === tokenHash && (!u.emailVerificationExpires || u.emailVerificationExpires > new Date())) {
          return u;
        }
      }
      return null;
    }
    return User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() }
    });
  }

  static async findByPasswordResetTokenHash(tokenHash) {
    if (isMemoryMode()) {
      const store = getMemoryStore('users');
      for (const u of store.values()) {
        if (u.passwordResetTokenHash === tokenHash && (!u.passwordResetExpires || u.passwordResetExpires > new Date())) {
          return u;
        }
      }
      return null;
    }
    return User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() }
    });
  }

  static async create(userData) {
    const cleanEmail = userData.email.toLowerCase().trim();
    
    // Check uniqueness
    const existing = await this.findByEmail(cleanEmail);
    if (existing) {
      const error = new Error('An account with this email address already exists');
      error.status = 409;
      error.code = 'EMAIL_ALREADY_EXISTS';
      throw error;
    }

    if (isMemoryMode()) {
      const store = getMemoryStore('users');
      const id = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const user = {
        _id: id,
        id,
        email: cleanEmail,
        passwordHash: userData.passwordHash,
        role: userData.role || 'investigator',
        accountStatus: userData.accountStatus || 'pending',
        emailVerified: userData.emailVerified || false,
        emailVerificationTokenHash: userData.emailVerificationTokenHash || null,
        emailVerificationExpires: userData.emailVerificationExpires || null,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
        mfaEnabled: userData.mfaEnabled || false,
        mfaSecret: userData.mfaSecret || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        comparePassword: async function (plain) {
          const bcrypt = require('bcryptjs');
          return bcrypt.compare(plain, this.passwordHash);
        },
        toSafeJSON: function () {
          const obj = { ...this };
          delete obj.passwordHash;
          delete obj.mfaSecret;
          delete obj.emailVerificationTokenHash;
          delete obj.passwordResetTokenHash;
          return obj;
        }
      };
      store.set(id, user);
      return user;
    }

    return User.create({
      ...userData,
      email: cleanEmail
    });
  }

  static async update(id, updates) {
    if (isMemoryMode()) {
      const store = getMemoryStore('users');
      const user = store.get(String(id));
      if (!user) return null;
      Object.assign(user, updates, { updatedAt: new Date() });
      store.set(String(id), user);
      return user;
    }
    return User.findByIdAndUpdate(id, updates, { returnDocument: 'after' });
  }

  static async list({ role, status, page = 1, limit = 20 } = {}) {
    if (isMemoryMode()) {
      const store = getMemoryStore('users');
      let items = Array.from(store.values());
      if (role) items = items.filter(u => u.role === role);
      if (status) items = items.filter(u => u.accountStatus === status);
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const skip = (page - 1) * limit;
      return {
        users: items.slice(skip, skip + limit).map(u => (u.toSafeJSON ? u.toSafeJSON() : u)),
        total: items.length,
        page,
        limit
      };
    }

    const query = {};
    if (role) query.role = role;
    if (status) query.accountStatus = status;

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query)
    ]);

    return {
      users: users.map(u => u.toSafeJSON()),
      total,
      page,
      limit
    };
  }
}

module.exports = UserService;
