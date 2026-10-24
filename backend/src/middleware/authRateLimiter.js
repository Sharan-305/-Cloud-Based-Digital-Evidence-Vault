const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for sensitive authentication operations
 * (Brute force protection for login, register, mfa, and password reset)
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP in 15 mins
  skip: () => process.env.NODE_ENV === 'test', // Skip in automated test runner
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    }
  }
});

module.exports = authRateLimiter;
