const express = require('express');
const alertController = require('../controllers/alert.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// View alerts (Admin, Investigator, Auditor)
router.get('/', alertController.listAlerts);

// Resolve alert (Admin only)
router.patch('/:id/resolve', requireRole('admin'), alertController.resolveAlert);

module.exports = router;
