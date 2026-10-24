const express = require('express');
const backupController = require('../controllers/backup.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// Review backup status
router.get('/status', backupController.getBackupStatus);

// Trigger manual backup & verification (Administrator only)
router.post('/run', requireRole('admin'), backupController.runBackup);

module.exports = router;
