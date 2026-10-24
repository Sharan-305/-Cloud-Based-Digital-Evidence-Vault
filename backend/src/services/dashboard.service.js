const { Evidence, AccessRequest, IntegrityCheck, Alert, AuditLog } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');

class DashboardService {
  /**
   * Aggregate role-aware dashboard statistics
   */
  static async getStats(user) {
    if (isMemoryMode()) {
      const evStore = getMemoryStore('evidence');
      const reqStore = getMemoryStore('accessrequests');
      const chkStore = getMemoryStore('integritychecks');
      const alertStore = getMemoryStore('alerts');
      const auditStore = getMemoryStore('auditlogs');

      const totalEvidence = evStore.size;
      const pendingApprovals = Array.from(reqStore.values()).filter(r => r.decision === 'PENDING').length;
      const checks = Array.from(chkStore.values());
      const validChecks = checks.filter(c => c.result === 'VALID').length;
      const integrityRate = checks.length > 0 ? Math.round((validChecks / checks.length) * 100) : 100;
      const unresolvedAlerts = Array.from(alertStore.values()).filter(a => a.status === 'OPEN').length;

      const recentAudit = Array.from(auditStore.values())
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5);

      return {
        role: user.role,
        metrics: {
          totalEvidence,
          pendingApprovals,
          integrityCheckSuccessRate: `${integrityRate}%`,
          unresolvedAlerts
        },
        recentActivity: recentAudit
      };
    }

    const [
      totalEvidence,
      pendingApprovals,
      checks,
      unresolvedAlerts,
      recentActivity
    ] = await Promise.all([
      Evidence.countDocuments(),
      AccessRequest.countDocuments({ decision: 'PENDING' }),
      IntegrityCheck.find().sort({ checkedAt: -1 }).limit(20).lean(),
      Alert.countDocuments({ status: 'OPEN' }),
      AuditLog.find().sort({ timestamp: -1 }).limit(5).lean()
    ]);

    const validChecks = checks.filter(c => c.result === 'VALID').length;
    const integrityRate = checks.length > 0 ? Math.round((validChecks / checks.length) * 100) : 100;

    return {
      role: user.role,
      metrics: {
        totalEvidence,
        pendingApprovals,
        integrityCheckSuccessRate: `${integrityRate}%`,
        unresolvedAlerts
      },
      recentActivity
    };
  }
}

module.exports = DashboardService;
