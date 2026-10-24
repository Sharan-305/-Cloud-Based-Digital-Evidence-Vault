const UserService = require('../services/user.service');
const AuditService = require('../services/audit.service');

async function getMe(req, res, next) {
  try {
    const user = req.user;
    res.status(200).json({
      user: user.toSafeJSON ? user.toSafeJSON() : user
    });
  } catch (err) {
    next(err);
  }
}

async function getUsers(req, res, next) {
  try {
    const { role, status, page, limit } = req.query;
    const result = await UserService.list({
      role,
      status,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10)
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['pending', 'active', 'suspended', 'disabled'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        error: {
          message: `Invalid status. Must be one of: ${allowed.join(', ')}`,
          code: 'INVALID_STATUS',
          correlationId: req.correlationId
        }
      });
    }

    const updated = await UserService.update(id, { accountStatus: status });
    if (!updated) {
      return res.status(404).json({
        error: {
          message: 'User not found.',
          code: 'USER_NOT_FOUND',
          correlationId: req.correlationId
        }
      });
    }

    await AuditService.log({
      actorId: req.user._id || req.user.id,
      action: 'USER_STATUS_UPDATED',
      targetType: 'USER',
      targetId: String(id),
      result: 'SUCCESS',
      correlationId: req.correlationId,
      safeContext: { newStatus: status, targetEmail: updated.email }
    });

    res.status(200).json({
      message: `Account status updated to '${status}'.`,
      user: updated.toSafeJSON ? updated.toSafeJSON() : updated
    });
  } catch (err) {
    next(err);
  }
}

async function updateRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowed = ['admin', 'investigator', 'auditor'];
    if (!role || !allowed.includes(role)) {
      return res.status(400).json({
        error: {
          message: `Invalid role. Must be one of: ${allowed.join(', ')}`,
          code: 'INVALID_ROLE',
          correlationId: req.correlationId
        }
      });
    }

    const updated = await UserService.update(id, { role });
    if (!updated) {
      return res.status(404).json({
        error: {
          message: 'User not found.',
          code: 'USER_NOT_FOUND',
          correlationId: req.correlationId
        }
      });
    }

    await AuditService.log({
      actorId: req.user._id || req.user.id,
      action: 'USER_ROLE_UPDATED',
      targetType: 'USER',
      targetId: String(id),
      result: 'SUCCESS',
      correlationId: req.correlationId,
      safeContext: { newRole: role, targetEmail: updated.email }
    });

    res.status(200).json({
      message: `User role updated to '${role}'.`,
      user: updated.toSafeJSON ? updated.toSafeJSON() : updated
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMe,
  getUsers,
  updateStatus,
  updateRole
};
