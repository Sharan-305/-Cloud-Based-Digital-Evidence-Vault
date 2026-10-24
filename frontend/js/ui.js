/**
 * Accessible UI helpers and notifications
 * Adheres to SKILL.md: purpose, agency, visible focus, aria live regions, non-color-only statuses
 */
const UI = {
  /**
   * Display accessible toast alert
   */
  showAlert(containerId, type, message, autoDismissMs = 6000) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const alertEl = document.createElement('div');
    alertEl.className = `alert alert-${type}`;
    alertEl.setAttribute('role', type === 'danger' ? 'alert' : 'status');
    alertEl.setAttribute('aria-live', 'polite');

    const icon = type === 'success' ? '✓' : type === 'danger' ? '⚠' : type === 'warning' ? '!' : 'ℹ';

    alertEl.innerHTML = `
      <span aria-hidden="true" style="font-weight: bold; font-size: 1.1em;">${icon}</span>
      <div style="flex: 1;">${this.escapeHtml(message)}</div>
      <button type="button" class="btn btn-secondary btn-sm" aria-label="Dismiss notice" style="width: auto; padding: 2px 6px;">✕</button>
    `;

    const closeBtn = alertEl.querySelector('button');
    closeBtn.addEventListener('click', () => alertEl.remove());

    container.innerHTML = '';
    container.appendChild(alertEl);

    if (autoDismissMs > 0) {
      setTimeout(() => {
        if (alertEl.parentNode) {
          alertEl.remove();
        }
      }, autoDismissMs);
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Render status badges paired with text and icon
   */
  renderStatusBadge(status) {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'active':
      case 'valid':
      case 'approved':
      case 'healthy':
        return `<span class="badge badge-success"><span aria-hidden="true">●</span> Active</span>`;
      case 'pending':
      case 'intake_pending':
      case 'investigating':
        return `<span class="badge badge-warning"><span aria-hidden="true">◷</span> Pending</span>`;
      case 'mismatch':
      case 'tamper_detected':
      case 'rejected':
      case 'disabled':
        return `<span class="badge badge-danger"><span aria-hidden="true">✖</span> Tamper / Denied</span>`;
      default:
        return `<span class="badge badge-info"><span aria-hidden="true">ℹ</span> ${this.escapeHtml(status)}</span>`;
    }
  }
};

window.UI = UI;
