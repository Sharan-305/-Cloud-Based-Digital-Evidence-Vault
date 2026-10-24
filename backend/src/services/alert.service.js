const { Alert } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');
const AuditService = require('./audit.service');

class AlertService {
  /**
   * Create a security or integrity alert
   */
  static async createAlert({
    evidenceId = null,
    alertType,
    severity = 'HIGH',
    description,
    correlationId
  }) {
    const alertData = {
      evidenceId,
      alertType,
      severity,
      description,
      status: 'OPEN',
      createdAt: new Date(),
      resolvedBy: null,
      resolvedAt: null,
      resolutionNotes: ''
    };

    let savedAlert;
    if (isMemoryMode()) {
      const store = getMemoryStore('alerts');
      const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      savedAlert = { _id: id, id, ...alertData };
      store.set(id, savedAlert);
    } else {
      savedAlert = await Alert.create(alertData);
    }

    await AuditService.log({
      systemActor: 'integrity_monitor',
      action: 'TAMPER_ALERT_RAISED',
      targetType: 'ALERT',
      targetId: String(savedAlert._id || savedAlert.id),
      result: 'TAMPER_DETECTED',
      correlationId,
      safeContext: { evidenceId, alertType, severity }
    });

    return savedAlert;
  }

  /**
   * List alerts with optional status/severity filters and pagination
   */
  static async listAlerts({ status, severity, page = 1, limit = 20 } = {}) {
    if (isMemoryMode()) {
      const store = getMemoryStore('alerts');
      let items = Array.from(store.values());

      if (status) items = items.filter(a => a.status === status);
      if (severity) items = items.filter(a => a.severity === severity);

      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const skip = (page - 1) * limit;
      return {
        alerts: items.slice(skip, skip + limit),
        total: items.length,
        page,
        limit
      };
    }

    const filter = {};
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const skip = (page - 1) * limit;
    const [alerts, total] = await Promise.all([
      Alert.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Alert.countDocuments(filter)
    ]);

    return { alerts, total, page, limit };
  }

  /**
   * Mark an alert as investigated/resolved
   */
  static async resolveAlert({ alertId, resolutionNotes, user, correlationId }) {
    if (isMemoryMode()) {
      const store = getMemoryStore('alerts');
      const alert = store.get(String(alertId));
      if (!alert) {
        const err = new Error('Alert not found.');
        err.status = 404;
        throw err;
      }

      alert.status = 'RESOLVED';
      alert.resolvedBy = user._id || user.id;
      alert.resolvedAt = new Date();
      alert.resolutionNotes = resolutionNotes || 'Investigated and resolved by Administrator';
      store.set(String(alertId), alert);

      await AuditService.log({
        actorId: user._id || user.id,
        action: 'ALERT_RESOLVED',
        targetType: 'ALERT',
        targetId: String(alertId),
        result: 'SUCCESS',
        correlationId,
        safeContext: { resolutionNotes: alert.resolutionNotes }
      });

      return alert;
    }

    const updated = await Alert.findByIdAndUpdate(
      alertId,
      {
        status: 'RESOLVED',
        resolvedBy: user._id || user.id,
        resolvedAt: new Date(),
        resolutionNotes: resolutionNotes || 'Investigated and resolved by Administrator'
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      const err = new Error('Alert not found.');
      err.status = 404;
      throw err;
    }

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'ALERT_RESOLVED',
      targetType: 'ALERT',
      targetId: String(alertId),
      result: 'SUCCESS',
      correlationId,
      safeContext: { resolutionNotes: updated.resolutionNotes }
    });

    return updated;
  }
}

module.exports = AlertService;
