/**
 * Global API Error Handler
 * Returns safe JSON messages without exposing internal stack traces in production.
 */
function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId || 'unknown';
  const statusCode = err.status || err.statusCode || 500;

  // Log error internally for operational diagnostics
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] [${correlationId}]`, err.message, err.stack);
  }

  // Safe client response
  const response = {
    error: {
      message: statusCode === 500 && process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : (err.message || 'An unexpected error occurred'),
      code: err.code || 'INTERNAL_ERROR',
      correlationId
    }
  };

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
