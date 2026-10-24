/**
 * Access Requests & Approvals Controller
 */
const AccessRequests = {
  async init() {
    await this.loadQueue();
  },

  async handleSubmit(e) {
    e.preventDefault();
    const evidenceId = document.getElementById('req-evidence-id').value;
    const requestedDuration = document.getElementById('req-duration').value;
    const reason = document.getElementById('req-justification').value;

    try {
      window.UI.showAlert('access-alert-container', 'info', 'Submitting access request...');
      const res = await window.API.post('/access-requests', {
        evidenceId,
        requestedDuration,
        reason
      });

      window.UI.showAlert('access-alert-container', 'success', 'Access request submitted. Awaiting Administrator decision.');
      e.target.reset();
      this.loadQueue();
    } catch (err) {
      window.UI.showAlert('access-alert-container', 'danger', `Submission failed: ${err.message}`);
    }
  },

  async loadQueue() {
    const tableBody = document.getElementById('access-queue-body');
    if (!tableBody) return;

    try {
      const data = await window.API.get('/access-requests');
      if (data && data.requests) {
        if (data.requests.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: var(--space-4);">No active access requests in queue.</td></tr>`;
          return;
        }

        tableBody.innerHTML = data.requests.map(req => {
          const reqEmail = req.requesterId ? (req.requesterId.email || req.requesterId) : 'N/A';
          const isPending = req.decision === 'PENDING';
          const actionHtml = isPending ? `
            <div style="display: flex; gap: var(--space-1);">
              <button type="button" class="btn btn-primary btn-sm" onclick="AccessRequests.approve('${req._id || req.id}')">Approve</button>
              <button type="button" class="btn btn-danger btn-sm" onclick="AccessRequests.reject('${req._id || req.id}')">Reject</button>
            </div>
          ` : `<span>${window.UI.renderStatusBadge(req.decision)}</span>`;

          return `
            <tr>
              <td>${window.UI.escapeHtml(reqEmail)}</td>
              <td class="font-mono">${window.UI.escapeHtml(req.evidenceId)}</td>
              <td>${req.requestedDuration} hrs</td>
              <td>${actionHtml}</td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('[AccessRequests] Error loading queue:', err.message);
    }
  },

  approve(requestId) {
    window.UI.confirmAction({
      title: 'Approve Access Request',
      message: 'Are you sure you want to approve this access request? The investigator will be granted time-bound download and verification privileges.',
      confirmText: 'Approve Request',
      confirmClass: 'btn-primary',
      onConfirm: async () => {
        try {
          await window.API.post(`/access-requests/${encodeURIComponent(requestId)}/approve`, {
            decisionReason: 'Approved by Administrator via Control Surface'
          });
          window.UI.showAlert('access-alert-container', 'success', 'Access request approved. Expiry set.');
          this.loadQueue();
        } catch (err) {
          window.UI.showAlert('access-alert-container', 'danger', `Approval failed: ${err.message}`);
        }
      }
    });
  },

  reject(requestId) {
    window.UI.confirmAction({
      title: 'Reject Access Request',
      message: 'Are you sure you want to reject this access request? The requester will be denied access to the evidence item.',
      confirmText: 'Reject Request',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        try {
          await window.API.post(`/access-requests/${encodeURIComponent(requestId)}/reject`, {
            decisionReason: 'Rejected by Reviewer'
          });
          window.UI.showAlert('access-alert-container', 'warning', 'Access request rejected.');
          this.loadQueue();
        } catch (err) {
          window.UI.showAlert('access-alert-container', 'danger', `Rejection failed: ${err.message}`);
        }
      }
    });
  }
};

window.AccessRequests = AccessRequests;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('access-queue-body')) {
    AccessRequests.init();
  }
});
