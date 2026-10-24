const AlertService = require('../services/alert.service');

async function listAlerts(req, res, next) {
  try {
    const { status, severity, page, limit } = req.query;
    const result = await AlertService.listAlerts({
      status,
      severity,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10)
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function resolveAlert(req, res, next) {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;

    const alert = await AlertService.resolveAlert({
      alertId: id,
      resolutionNotes,
      user: req.user,
      correlationId: req.correlationId
    });

    res.status(200).json({
      message: 'Alert resolved successfully.',
      alert
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAlerts,
  resolveAlert
};
