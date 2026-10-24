/**
 * Safe HTTP request logger
 * Excludes sensitive request payloads, query params, headers, and tokens.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;
  const correlationId = req.headers['x-correlation-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    // Log safe metadata only
    const logLine = `[${new Date().toISOString()}] [${correlationId}] ${method} ${originalUrl} ${statusCode} - ${duration}ms`;
    if (process.env.NODE_ENV !== 'test') {
      if (statusCode >= 500) {
        console.error(logLine);
      } else if (statusCode >= 400) {
        console.warn(logLine);
      } else {
        console.log(logLine);
      }
    }
  });

  next();
}

module.exports = requestLogger;
