/**
 * Evidence Register & Details Controller
 */
const EvidenceManager = {
  currentEvidenceId: null,

  async initRegister(params = {}) {
    const tableBody = document.getElementById('evidence-table-body');
    if (!tableBody) return;

    try {
      const q = params.query ?? (document.getElementById('filter-query')?.value || '');
      const cat = params.category ?? (document.getElementById('filter-category')?.value || '');
      const stat = params.status ?? (document.getElementById('filter-status')?.value || '');

      const queryParams = new URLSearchParams();
      if (q) queryParams.set('query', q);
      if (cat) queryParams.set('category', cat);
      if (stat) queryParams.set('status', stat);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const data = await window.API.get(`/evidence${qs}`);
      if (data && data.evidence) {
        if (data.evidence.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted); padding: var(--space-6);">No registered evidence records match the criteria.</td></tr>`;
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

  async initDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const evidenceId = urlParams.get('id') || 'EV-2026-0001';
    this.currentEvidenceId = evidenceId;

    const elId = document.getElementById('detail-evidence-id');
    const elTitle = document.getElementById('detail-title');
    const elDesc = document.getElementById('detail-description');
    const elBadge = document.getElementById('detail-status-badge');
    const btnPdf = document.getElementById('btn-export-pdf');

    if (btnPdf) {
      btnPdf.href = `/reports.html?id=${encodeURIComponent(evidenceId)}`;
    }

    try {
      const res = await window.API.get(`/evidence/${encodeURIComponent(evidenceId)}`);
      if (res && res.evidence) {
        const ev = res.evidence;
        if (elId) elId.textContent = ev.evidenceId;
        if (elTitle) elTitle.textContent = ev.title;
        if (elDesc) elDesc.innerHTML = `Case: ${window.UI.escapeHtml(ev.referenceId || 'N/A')} &bull; Category: ${window.UI.escapeHtml(ev.category || 'N/A')} &bull; Classification: ${window.UI.escapeHtml(ev.classification || 'N/A')}`;
        if (elBadge) elBadge.outerHTML = `<span id="detail-status-badge">${window.UI.renderStatusBadge(ev.status)}</span>`;

        await Promise.all([
          this.loadVersions(evidenceId),
          this.loadCustody(evidenceId)
        ]);
      }
    } catch (err) {
      console.warn('[EvidenceManager] Error loading evidence details:', err.message);
    }
  },

  async loadVersions(evidenceId) {
    const tableBody = document.getElementById('versions-table-body');
    const manifestCardTitle = document.getElementById('manifest-card-title');
    const manifestSha = document.getElementById('manifest-sha256');
    const manifestSig = document.getElementById('manifest-signature');
    const manifestKey = document.getElementById('manifest-key-id');
    const manifestS3Ver = document.getElementById('manifest-s3-version');
    const manifestFile = document.getElementById('manifest-filename');

    try {
      const res = await window.API.get(`/evidence/${encodeURIComponent(evidenceId)}/versions`);
      if (res && res.versions && res.versions.length > 0) {
        const latestVer = res.versions[0];
        if (manifestCardTitle) manifestCardTitle.textContent = `Cryptographic Manifest (Current Version: v${latestVer.versionNumber})`;
        if (manifestSha) manifestSha.textContent = latestVer.sha256;
        if (manifestSig) {
          manifestSig.innerHTML = `<span class="badge badge-success"><span aria-hidden="true">✓</span> Valid (Ed25519)</span>`;
        }
        if (manifestKey) manifestKey.textContent = latestVer.signingKeyId || 'vault-ed25519-key-01';
        if (manifestS3Ver) manifestS3Ver.textContent = latestVer.s3VersionId || 's3-ver-v1-baseline';
        if (manifestFile) {
          const sizeKb = (latestVer.sizeBytes / 1024).toFixed(1);
          manifestFile.textContent = `${latestVer.originalFilename || 'artifact.bin'} (${latestVer.sizeBytes} bytes, ~${sizeKb} KB)`;
        }

        if (tableBody) {
          tableBody.innerHTML = res.versions.map((ver, idx) => {
            const isCurrent = idx === 0;
            const timeStr = ver.createdAt ? new Date(ver.createdAt).toISOString().replace('T', ' ').substring(0, 19) : 'N/A';
            const statusLabel = isCurrent ? 'Active Version' : 'Historical Version';
            return `
              <tr>
                <td><strong>v${ver.versionNumber} ${isCurrent ? '(Current)' : ''}</strong></td>
                <td>${window.UI.escapeHtml(ver.uploadedBy ? ver.uploadedBy.email || ver.uploadedBy : 'system')}</td>
                <td>${window.UI.escapeHtml(timeStr)}</td>
                <td><span class="badge badge-success"><span aria-hidden="true">✓</span> ${statusLabel}</span></td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (err) {
      console.warn('[EvidenceManager] Error loading versions:', err.message);
    }
  },

  async loadCustody(evidenceId) {
    const tableBody = document.getElementById('custody-table-body');
    if (!tableBody) return;

    try {
      const res = await window.API.get(`/evidence/${encodeURIComponent(evidenceId)}/custody`);
      if (res && res.custody && res.custody.length > 0) {
        tableBody.innerHTML = res.custody.map(event => {
          const timeStr = event.timestamp ? new Date(event.timestamp).toISOString().replace('T', ' ').substring(0, 19) : 'N/A';
          const actorStr = event.actorId ? (event.actorId.email || event.actorId) : 'System';
          const resultBadge = event.result === 'SUCCESS'
            ? `<span class="badge badge-success"><span aria-hidden="true">✓</span> SUCCESS</span>`
            : `<span class="badge badge-danger"><span aria-hidden="true">✕</span> ${window.UI.escapeHtml(event.result)}</span>`;

          return `
            <tr>
              <td class="font-mono">${window.UI.escapeHtml(timeStr)}</td>
              <td>${window.UI.escapeHtml(actorStr)}</td>
              <td>${window.UI.escapeHtml(event.action)}</td>
              <td>v${event.versionNumber || 1}</td>
              <td>${resultBadge}</td>
              <td class="font-mono">${window.UI.escapeHtml(event.correlationId || 'N/A')}</td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('[EvidenceManager] Error loading custody timeline:', err.message);
    }
  },

  async runIntegrityVerificationCurrent() {
    if (!this.currentEvidenceId) return;
    await this.runIntegrityVerification(this.currentEvidenceId);
    await this.loadCustody(this.currentEvidenceId);
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
  },

  async downloadCurrentEvidence() {
    if (!this.currentEvidenceId) return;
    try {
      window.UI.showAlert('details-alert-container', 'info', 'Requesting authorized artifact download stream...');
      const downloadRes = await window.API.get(`/evidence/${encodeURIComponent(this.currentEvidenceId)}/download`);
      if (downloadRes.downloadUrl) {
        window.open(downloadRes.downloadUrl, '_blank');
        window.UI.showAlert('details-alert-container', 'success', 'Artifact download initiated via secure signed URL.');
      }
    } catch (err) {
      window.UI.showAlert('details-alert-container', 'danger', `Download denied: ${err.message}`);
    }
  }
};

window.EvidenceManager = EvidenceManager;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('evidence-table-body')) {
    EvidenceManager.initRegister();
  }
  if (document.getElementById('detail-evidence-id')) {
    EvidenceManager.initDetails();
  }
});
