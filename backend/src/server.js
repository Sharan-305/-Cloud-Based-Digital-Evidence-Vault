const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, config.host, () => {
  console.log(`[Cloud Evidence Vault API] Server running on http://${config.host}:${config.port} in ${config.env} mode`);
  console.log(`[Cloud Evidence Vault API] Static frontend serving from ${config.frontendPath}`);
  console.log(`[Cloud Evidence Vault API] Health check endpoint: http://${config.host}:${config.port}/api/health`);
});

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });

  // Force close if graceful termination hangs
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = server;
