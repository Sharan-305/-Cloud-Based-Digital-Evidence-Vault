/**
 * Client authentication state helper
 */
const Auth = {
  getToken() {
    return localStorage.getItem('vault_auth_token');
  },

  getUser() {
    try {
      const data = localStorage.getItem('vault_user_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setUser(user, token) {
    if (token) localStorage.setItem('vault_auth_token', token);
    if (user) localStorage.setItem('vault_user_session', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('vault_auth_token');
    localStorage.removeItem('vault_user_session');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  requireAuth(targetRole = null) {
    const user = this.getUser();
    if (!this.isAuthenticated() || !user) {
      // Allow browsing in demo/mock phase, but prepare redirect for phase 2
      console.info('[Auth] Unauthenticated access check.');
      return false;
    }

    if (targetRole && user.role !== targetRole && user.role !== 'admin') {
      console.warn(`[Auth] User role '${user.role}' lacks requirement for '${targetRole}'`);
      return false;
    }

    return true;
  },

  updateHeaderUI() {
    const user = this.getUser();
    const rolePill = document.getElementById('user-role-badge');
    const userEmailSpan = document.getElementById('user-display-email');
    const authBtn = document.getElementById('nav-auth-btn');

    if (user && rolePill && userEmailSpan) {
      rolePill.textContent = (user.role || 'Investigator').toUpperCase();
      userEmailSpan.textContent = user.email || 'investigator@demo.vault';
      if (authBtn) {
        authBtn.textContent = 'Sign Out';
        authBtn.href = '#';
        authBtn.onclick = (e) => {
          e.preventDefault();
          Auth.clearSession();
          window.location.href = '/login.html';
        };
      }
    }
  },

  async handleLoginFormSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const mfaCode = document.getElementById('login-mfa').value;

    try {
      window.UI.showAlert('auth-alert-container', 'info', 'Authenticating credentials and verifying TOTP...');
      const res = await window.API.post('/auth/login', { email, password, mfaCode });
      if (res && res.token && res.user) {
        Auth.setUser(res.user, res.token);
        window.UI.showAlert('auth-alert-container', 'success', 'Authentication successful. Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 800);
      }
    } catch (err) {
      window.UI.showAlert('auth-alert-container', 'danger', `Authentication failed: ${err.message}`);
    }
  }
};

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', () => {
  Auth.updateHeaderUI();

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => Auth.handleLoginFormSubmit(e));
  }
});
