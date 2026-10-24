const config = require('../config');
const { isDbConnected, isMemoryMode } = require('../config/database');

/**
 * Health & readiness controller
 */
function getHealth(req, res) {
  const uptime = process.uptime();
  const timestamp = new Date().toISOString();
  const dbConnected = isDbConnected();

  res.status(200).json({
    status: dbConnected ? 'healthy' : 'degraded',
    timestamp,
    uptimeSeconds: Math.floor(uptime),
    environment: config.env,
    version: '1.0.0',
    subsystems: {
      api: 'operational',
      database: dbConnected ? (isMemoryMode() ? 'connected_memory_adapter' : 'connected_mongodb') : 'disconnected',
      storageS3: 'phase3_pending'
    }
  });
}

module.exports = {
  getHealth
};
