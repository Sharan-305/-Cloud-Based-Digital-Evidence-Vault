const express = require('express');
const evidenceController = require('../controllers/evidence.controller');
const authenticate = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');

const router = express.Router();

// All evidence routes require authentication
router.use(authenticate);

// Evidence Register listing & search (Admin, Investigator, Auditor)
router.get('/', evidenceController.listEvidence);

// Intake new evidence (Investigator only)
router.post('/', requireRole('investigator'), evidenceController.createEvidence);

// Evidence details & versions
router.get('/:evidenceId', evidenceController.getEvidenceById);
router.get('/:evidenceId/versions', evidenceController.getEvidenceVersions);

// Add new version (Investigator only)
router.post('/:evidenceId/versions', requireRole('investigator'), evidenceController.createEvidenceVersion);

// Authorized download stream
router.get('/:evidenceId/download', evidenceController.downloadEvidence);

// Verification, Custody, and Reports scheduled for Phase 4 & 5
router.post('/:evidenceId/verify', (req, res) => res.status(501).json({ error: { message: 'Integrity verification scheduled for Phase 4', code: 'NOT_IMPLEMENTED' } }));
router.get('/:evidenceId/custody', (req, res) => res.status(501).json({ error: { message: 'Custody timeline scheduled for Phase 4', code: 'NOT_IMPLEMENTED' } }));
router.get('/:evidenceId/report', (req, res) => res.status(501).json({ error: { message: 'PDF report export scheduled for Phase 5', code: 'NOT_IMPLEMENTED' } }));

module.exports = router;
