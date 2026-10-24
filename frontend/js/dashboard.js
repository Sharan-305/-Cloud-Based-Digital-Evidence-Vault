/**
 * Dashboard Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  const metricsContainer = document.getElementById('dashboard-metrics');
  const alertsContainer = document.getElementById('recent-alerts-table');

  // Verify backend health
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
});
