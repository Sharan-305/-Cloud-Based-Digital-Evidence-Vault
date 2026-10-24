/**
 * Dashboard Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verify backend health
  try {
    const health = await window.API.get('/health');
    const healthStatusEl = document.getElementById('system-health-pill');
    if (healthStatusEl && health.status === 'healthy') {
      healthStatusEl.className = 'badge badge-success';
      healthStatusEl.innerHTML = '<span aria-hidden="true">●</span> System Online';
    }
  } catch (err) {
    const healthStatusEl = document.getElementById('system-health-pill');
    if (healthStatusEl) {
      healthStatusEl.className = 'badge badge-danger';
      healthStatusEl.innerHTML = '<span aria-hidden="true">⚠</span> Offline / Disconnected';
    }
  }

  // 2. Load live metrics if authenticated
  if (window.Auth && window.Auth.isAuthenticated()) {
    try {
      const stats = await window.API.get('/dashboard/stats');
      if (stats && stats.metrics) {
        const evCountEl = document.getElementById('stat-evidence-count');
        const reqCountEl = document.getElementById('stat-pending-requests');
        const integrityRateEl = document.getElementById('stat-integrity-rate');
        const alertCountEl = document.getElementById('stat-unresolved-alerts');

        if (evCountEl) evCountEl.textContent = stats.metrics.totalEvidence;
        if (reqCountEl) reqCountEl.textContent = stats.metrics.pendingApprovals;
        if (integrityRateEl) integrityRateEl.textContent = stats.metrics.integrityCheckSuccessRate;
        if (alertCountEl) {
          alertCountEl.textContent = stats.metrics.unresolvedAlerts;
          alertCountEl.style.color = stats.metrics.unresolvedAlerts > 0 ? 'var(--color-danger)' : 'var(--color-success)';
        }
      }
    } catch (err) {
      console.warn('[Dashboard] Metrics fetch failed:', err.message);
    }
  }
});
