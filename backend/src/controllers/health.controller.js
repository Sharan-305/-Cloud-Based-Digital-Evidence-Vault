const config = require('../config');

/**
 * Health & readiness controller
 */
function getHealth(req, res) {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();

  // Baseline health report (to be expanded in Phase 2 with DB and Phase 3 with S3)
  res.status(200).json({
    status: 'healthy',
    timestamp,
    uptimeSeconds: Math.floor(uptime),
    environment: config.env,
    version: '1.0.0',
    subsystems: {
      api: 'operational',
      database: 'phase2_pending',
      storageS3: 'phase3_pending'
    }
  });
}

module.exports = {
  getHealth
};
