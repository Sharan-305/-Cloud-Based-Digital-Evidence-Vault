/**
 * Evidence Register & Details Controller
 */
const EvidenceManager = {
  async initRegister() {
    const tableBody = document.getElementById('evidence-table-body');
    if (!tableBody) return;

    try {
      const data = await window.API.get('/evidence');
      if (data && data.evidence) {
        if (data.evidence.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: var(--space-6);">No registered evidence records found. Use the intake form below to upload evidence.</td></tr>`;
          return;
        }

        tableBody.innerHTML = data.evidence.map(ev => {
          const currentVer = ev.currentVersionId || {};
          const shaPreview = currentVer.sha256 ? `${currentVer.sha256.substring(0, 8)}...` : 'N/A';
          const verNumber = currentVer.versionNumber ? `v${currentVer.versionNumber}` : 'v1';

          return `
            <tr>
              <td class="font-mono"><strong>${window.UI.escapeHtml(ev.evidenceId)}</strong></td>
              <td>
                <div>${window.UI.escapeHtml(ev.title)}</div>
                <span class="form-help">Ref: ${window.UI.escapeHtml(ev.referenceId)}</span>
              </td>
              <td><span class="badge badge-info">${window.UI.escapeHtml(ev.category)}</span></td>
              <td>${verNumber}</td>
              <td class="font-mono" title="${window.UI.escapeHtml(currentVer.sha256 || '')}">${shaPreview}</td>
              <td>${window.UI.renderStatusBadge(ev.status)}</td>
              <td>
                <a href="/evidence-details.html?id=${encodeURIComponent(ev.evidenceId)}" class="btn btn-secondary btn-sm">Inspect</a>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('[EvidenceManager] Error loading register:', err.message);
    }
  },

  async handleIntakeFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const fileInput = document.getElementById('intake-file');

    if (!fileInput || !fileInput.files[0]) {
      window.UI.showAlert('intake-alert-container', 'danger', 'Please select an evidence file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('title', document.getElementById('intake-title').value);
    formData.append('referenceId', document.getElementById('intake-reference').value);
    formData.append('category', document.getElementById('intake-category').value);
    formData.append('classification', document.getElementById('intake-classification').value);
    formData.append('description', document.getElementById('intake-description').value);
    formData.append('file', fileInput.files[0]);

    try {
      window.UI.showAlert('intake-alert-container', 'info', 'Streaming evidence file to private vault and calculating SHA-256...');
      const response = await window.API.post('/evidence', formData);

      window.UI.showAlert('intake-alert-container', 'success', `Evidence intake completed! Evidence ID: ${response.evidence.evidenceId}. SHA-256: ${response.version.sha256.substring(0, 16)}...`);
      form.reset();
      this.initRegister();
    } catch (err) {
      window.UI.showAlert('intake-alert-container', 'danger', `Intake failed: ${err.message}`);
    }
  },

  async runIntegrityVerification(evidenceId, versionNumber = null) {
    try {
      window.UI.showAlert('details-alert-container', 'info', 'Streaming exact S3 version bytes and recalculating SHA-256 digest...');
      const res = await window.API.post(`/evidence/${encodeURIComponent(evidenceId)}/verify`, { versionNumber });

      if (res.report.result === 'VALID') {
        window.UI.showAlert('details-alert-container', 'success', `Integrity Verified: Calculated SHA-256 matches baseline and Ed25519 signature is valid.`);
      } else {
        window.UI.showAlert('details-alert-container', 'danger', `TAMPER DETECTED: ${res.report.result}. Baseline mismatch! Tamper alert automatically created.`);
      }
    } catch (err) {
      window.UI.showAlert('details-alert-container', 'danger', `Verification error: ${err.message}`);
    }
  }
};

window.EvidenceManager = EvidenceManager;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('evidence-table-body')) {
    EvidenceManager.initRegister();
  }
});
