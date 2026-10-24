const express = require('express');
const authController = require('../controllers/auth.controller');
const authRateLimiter = require('../middleware/authRateLimiter');
const authenticate = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/register', authRateLimiter, authController.register);
router.post('/verify-email', authRateLimiter, authController.verifyEmail);
router.post('/login', authRateLimiter, authController.login);
router.post('/mfa/verify', authRateLimiter, authController.verifyMfa);
router.post('/logout', (req, res, next) => {
  // Graceful optional authentication on logout
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticate(req, res, () => authController.logout(req, res, next));
  }
  return authController.logout(req, res, next);
});
router.post('/forgot-password', authRateLimiter, authController.forgotPassword);
router.post('/reset-password', authRateLimiter, authController.resetPassword);

module.exports = router;
