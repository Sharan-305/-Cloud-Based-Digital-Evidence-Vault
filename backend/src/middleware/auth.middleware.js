const { verifySessionToken } = require('../utils/token');
const UserService = require('../services/user.service');

/**
 * Authentication middleware
 * Verifies JWT token and checks user status
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // Check Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.vault_token) {
      token = req.cookies.vault_token;
    }

    if (!token) {
      return res.status(401).json({
        error: {
          message: 'Authentication required. No session token provided.',
          code: 'UNAUTHENTICATED',
          correlationId: req.correlationId
        }
      });
    }

    let payload;
    try {
      payload = verifySessionToken(token);
    } catch (err) {
      return res.status(401).json({
        error: {
          message: 'Invalid or expired session token.',
          code: 'INVALID_TOKEN',
          correlationId: req.correlationId
        }
      });
    }

    if (payload.stage !== 'authenticated') {
      return res.status(403).json({
        error: {
          message: 'Incomplete authentication. MFA verification required.',
          code: 'MFA_REQUIRED',
          correlationId: req.correlationId
        }
      });
    }

    const user = await UserService.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Authenticated user account no longer exists.',
          code: 'USER_NOT_FOUND',
          correlationId: req.correlationId
        }
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        error: {
          message: `Account is not active (status: ${user.accountStatus}).`,
          code: 'ACCOUNT_INACTIVE',
          correlationId: req.correlationId
        }
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authenticate;
