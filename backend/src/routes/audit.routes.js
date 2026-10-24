const express = require('express');
const auditController = require('../controllers/audit.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// View read-only audit log (Admin and Auditor only)
router.get('/', requireRole('admin', 'auditor'), auditController.listAuditLogs);

module.exports = router;
