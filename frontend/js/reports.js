/**
 * PDF Evidence Report Controller
 */
const ReportManager = {
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
