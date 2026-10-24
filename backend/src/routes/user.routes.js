const express = require('express');
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');

const router = express.Router();

// Current authenticated user profile
router.get('/me', authenticate, userController.getMe);

// Administrator-only user management
router.get('/', authenticate, requireRole('admin'), userController.getUsers);
router.patch('/:id/status', authenticate, requireRole('admin'), userController.updateStatus);
router.patch('/:id/role', authenticate, requireRole('admin'), userController.updateRole);

module.exports = router;
