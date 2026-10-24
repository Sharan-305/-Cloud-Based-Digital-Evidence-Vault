/**
 * Administrator User & Role Management Controller
 */
const UserManager = {
  async init() {
    await this.loadUsers();
  },

  async loadUsers() {
    const tableBody = document.getElementById('users-table-body');
    if (!tableBody) return;

    try {
      const data = await window.API.get('/users');
      if (data && data.users) {
        tableBody.innerHTML = data.users.map(u => {
          const isPending = u.accountStatus === 'pending';
          const actionBtn = isPending
            ? `<button type="button" class="btn btn-primary btn-sm" onclick="UserManager.setStatus('${u._id || u.id}', 'active')">Approve</button>`
            : `<button type="button" class="btn btn-secondary btn-sm" onclick="UserManager.toggleStatus('${u._id || u.id}', '${u.accountStatus}')">${u.accountStatus === 'active' ? 'Suspend' : 'Activate'}</button>`;

          return `
            <tr>
              <td><strong>${window.UI.escapeHtml(u.email)}</strong></td>
              <td><span class="role-pill">${window.UI.escapeHtml(u.role)}</span></td>
              <td>${window.UI.renderStatusBadge(u.accountStatus)}</td>
              <td>${u.mfaEnabled ? '<span class="badge badge-success"><span aria-hidden="true">✓</span> Enabled</span>' : '<span class="badge badge-warning"><span aria-hidden="true">◷</span> Pending Setup</span>'}</td>
              <td>${actionBtn}</td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.warn('[UserManager] Failed to load users:', err.message);
    }
  },

  async setStatus(userId, status) {
    try {
      await window.API.patch(`/users/${encodeURIComponent(userId)}/status`, { status });
      window.UI.showAlert('users-alert-container', 'success', `User status updated to '${status}'.`);
      this.loadUsers();
    } catch (err) {
      window.UI.showAlert('users-alert-container', 'danger', `Status update failed: ${err.message}`);
    }
  },

  async toggleStatus(userId, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const actionVerb = nextStatus === 'suspended' ? 'Suspend' : 'Activate';
    const confirmClass = nextStatus === 'suspended' ? 'btn-danger' : 'btn-primary';

    window.UI.confirmAction({
      title: `${actionVerb} User Account`,
      message: `Are you sure you want to change this user status to '${nextStatus}'? ${nextStatus === 'suspended' ? 'Suspended users will be immediately locked out of the vault.' : 'Active users will regain system access.'}`,
      confirmText: actionVerb,
      confirmClass: confirmClass,
      onConfirm: async () => {
        await this.setStatus(userId, nextStatus);
      }
    });
  }
};

window.UserManager = UserManager;

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('users-table-body')) {
    UserManager.init();
  }
});
