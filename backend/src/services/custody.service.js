const { CustodyEvent } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');

class CustodyService {
  /**
   * Get complete chain-of-custody timeline for an evidence record
   */
  static async getCustodyTimeline(evidenceId) {
    if (isMemoryMode()) {
      const store = getMemoryStore('custodyevents');
      const events = Array.from(store.values())
        .filter(e => e.evidenceId === evidenceId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return events;
    }

    return CustodyEvent.find({ evidenceId })
      .populate('actorId', 'email role')
      .sort({ timestamp: 1 })
      .lean();
  }

  /**
   * Record a custom custody event
   */
  static async recordEvent({
    evidenceId,
    versionNumber,
    actorId = null,
    systemActor = null,
    action,
    result,
    reason = '',
    correlationId,
    safeMetadata = {}
  }) {
    const eventData = {
      evidenceId,
      versionNumber,
      actorId,
      systemActor,
      action,
      timestamp: new Date(),
      result,
      reason,
      correlationId: correlationId || `corr-${Date.now()}`,
      safeMetadata
    };

    if (isMemoryMode()) {
      const store = getMemoryStore('custodyevents');
      const id = `cust-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const saved = { _id: id, id, ...eventData };
      store.set(id, saved);
      return saved;
    }

    return CustodyEvent.create(eventData);
  }
}

module.exports = CustodyService;
