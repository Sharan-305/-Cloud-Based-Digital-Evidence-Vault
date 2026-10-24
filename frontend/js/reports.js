/**
 * PDF Evidence Report Controller
 */
const ReportManager = {
  async init() {
    const select = document.getElementById('report-evidence-id');
    if (!select) return;

    const urlParams = new URLSearchParams(window.location.search);
    const preselectedId = urlParams.get('id');

    try {
      const data = await window.API.get('/evidence');
      if (data && data.evidence && data.evidence.length > 0) {
        select.innerHTML = data.evidence.map(ev => {
          const isSelected = preselectedId && ev.evidenceId === preselectedId ? 'selected' : '';
          return `<option value="${window.UI.escapeHtml(ev.evidenceId)}" ${isSelected}>${window.UI.escapeHtml(ev.evidenceId)} — ${window.UI.escapeHtml(ev.title)}</option>`;
        }).join('');
      } else if (preselectedId) {
        select.innerHTML = `<option value="${window.UI.escapeHtml(preselectedId)}" selected>${window.UI.escapeHtml(preselectedId)}</option>`;
      }
    } catch (err) {
      console.warn('[ReportManager] Failed to populate evidence options:', err.message);
    }
  },

  async handleExport(e) {
    e.preventDefault();
    const evidenceId = document.getElementById('report-evidence-id').value;
    const versionNumber = document.getElementById('report-version').value;

    if (!evidenceId) {
      window.UI.showAlert('report-alert-container', 'danger', 'Please enter or select an Evidence ID.');
      return;
    }

    try {
      window.UI.showAlert('report-alert-container', 'info', `Compiling canonical PDF report for ${evidenceId} (v${versionNumber})...`);

      // Open stream download
      const token = window.Auth.getToken();
      const url = `/api/evidence/${encodeURIComponent(evidenceId)}/report?versionNumber=${encodeURIComponent(versionNumber)}`;
      
      const res = await fetch(url, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `Failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Evidence_Report_${evidenceId}_v${versionNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      window.UI.showAlert('report-alert-container', 'success', 'PDF evidence report generated and downloaded.');
    } catch (err) {
      window.UI.showAlert('report-alert-container', 'danger', `Report generation failed: ${err.message}`);
    }
  }
};

window.ReportManager = ReportManager;

document.addEventListener('DOMContentLoaded', () => {
  ReportManager.init();
});
