const express = require('express');
const accessController = require('../controllers/access.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');

const router = express.Router();

router.use(authenticate);

// Submit request (Investigator only)
router.post('/', requireRole('investigator'), accessController.createRequest);

// List requests
router.get('/', accessController.listRequests);

// Reviewer actions (Administrator only)
router.post('/:id/approve', requireRole('admin'), accessController.approveRequest);
router.post('/:id/reject', requireRole('admin'), accessController.rejectRequest);
router.post('/:id/revoke', requireRole('admin'), accessController.revokeRequest);

module.exports = router;
