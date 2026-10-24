const AuditService = require('../services/audit.service');

async function listAuditLogs(req, res, next) {
  try {
    const { action, targetType, page, limit } = req.query;
    const result = await AuditService.list({
      action,
      targetType,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '50', 10)
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAuditLogs
};
