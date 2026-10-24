const { AuditLog } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');

/**
 * Append-only audit logger service
 */
class AuditService {
  /**
   * Record a security / system audit event
   */
  static async log({
    actorId = null,
    systemActor = null,
    action,
    targetType,
    targetId = null,
    result,
    correlationId,
    safeContext = {}
  }) {
    // Redact any accidentally passed sensitive keys
    const sanitizedContext = { ...safeContext };
    delete sanitizedContext.password;
    delete sanitizedContext.passwordHash;
    delete sanitizedContext.mfaSecret;
    delete sanitizedContext.token;
    delete sanitizedContext.secret;
    delete sanitizedContext.rawBytes;

    const auditEntry = {
      actorId,
      systemActor,
      action,
      targetType,
      targetId,
      timestamp: new Date(),
      result,
      correlationId: correlationId || `corr-${Date.now()}`,
      safeContext: sanitizedContext
    };

    if (isMemoryMode()) {
      auditEntry._id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const store = getMemoryStore('auditlogs');
      store.set(auditEntry._id, auditEntry);
      return auditEntry;
    }

    try {
      return await AuditLog.create(auditEntry);
    } catch (err) {
      console.error('[AuditService] Failed to persist audit log:', err.message);
      // Fallback to in-memory store so audit events are not dropped
      auditEntry._id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const store = getMemoryStore('auditlogs');
      store.set(auditEntry._id, auditEntry);
      return auditEntry;
    }
  }

  /**
   * Query audit logs with pagination and filters
   */
  static async list({ action, targetType, limit = 50, page = 1 } = {}) {
    if (isMemoryMode()) {
      const store = getMemoryStore('auditlogs');
      let items = Array.from(store.values());
      if (action) items = items.filter(i => i.action === action);
      if (targetType) items = items.filter(i => i.targetType === targetType);
      items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const skip = (page - 1) * limit;
      return {
        logs: items.slice(skip, skip + limit),
        total: items.length,
        page,
        limit
      };
    }

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query)
    ]);

    return { logs, total, page, limit };
  }
}

module.exports = AuditService;
