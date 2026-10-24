/**
 * Role-Based Access Control Middleware
 * Enforces deny-by-default on all protected resources
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required before role check.',
          code: 'UNAUTHENTICATED',
          correlationId: req.correlationId
        }
      });
    }

    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: {
          message: `Access denied. Requires one of [${allowedRoles.join(', ')}], but current role is '${userRole}'.`,
          code: 'FORBIDDEN_ROLE',
          correlationId: req.correlationId
        }
      });
    }

    next();
  };
}

module.exports = {
  requireRole
};
