/**
 * Audit Logs Controller
 */
const AuditLogManager = {
  async init() {
    await this.loadLogs();
  },

  async loadLogs() {
    const tableBody = document.getElementById('audit-table-body');
    if (!tableBody) return;

    try {
      const data = await window.API.get('/audit-logs');
      if (data && data.logs) {
        if (data.logs.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: var(--space-6);">No audit log events found in immutable journal.</td></tr>`;
          return;
        }

        tableBody.innerHTML = data.logs.map(log => {
          const actor = log.actorId && log.actorId.email ? log.actorId.email : (log.systemActor || 'System/Signer');
          const timestamp = log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19) : 'N/A';
          const target = log.targetId ? `${log.targetType}: ${log.targetId}` : log.targetType;

          return `
            <tr>
              <td class="font-mono">${window.UI.escapeHtml(timestamp)}</td>
              <td>${window.UI.escapeHtml(actor)}</td>
              <td><strong>${window.UI.escapeHtml(log.action)}</strong></td>
              <td class="font-mono">${window.UI.escapeHtml(target)}</td>
              <td>${window.UI.renderStatusBadge(log.result)}</td>
              <td class="font-mono">${window.UI.escapeHtml(log.correlationId || 'N/A')}</td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('[AuditLogManager] Error loading audit logs:', err.message);
    }
  }
};

window.AuditLogManager = AuditLogManager;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('audit-table-body')) {
    AuditLogManager.init();
  }
});
