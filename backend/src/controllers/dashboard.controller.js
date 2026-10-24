const DashboardService = require('../services/dashboard.service');

async function getStats(req, res, next) {
  try {
    const stats = await DashboardService.getStats(req.user);
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats
};
