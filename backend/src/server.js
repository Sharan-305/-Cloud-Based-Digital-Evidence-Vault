const app = require('./app');
const config = require('./config');
const { connectDB, disconnectDB } = require('./config/database');

let server;

async function startServer() {
  try {
    // Initialize database connectivity
    await connectDB();

    server = app.listen(config.port, config.host, () => {
      console.log(`[Cloud Evidence Vault API] Server running on http://${config.host}:${config.port} in ${config.env} mode`);
      console.log(`[Cloud Evidence Vault API] Static frontend serving from ${config.frontendPath}`);
      console.log(`[Cloud Evidence Vault API] Health check endpoint: http://${config.host}:${config.port}/api/health`);
    });
  } catch (err) {
    console.error('[Server] Failed to initialize server:', err);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function handleShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDB();
      console.log('[Server] Database disconnected.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }

  // Force close if graceful termination hangs
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = app;
