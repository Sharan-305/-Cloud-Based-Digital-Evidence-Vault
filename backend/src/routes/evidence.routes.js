const express = require('express');
const evidenceController = require('../controllers/evidence.controller');
const integrityController = require('../controllers/integrity.controller');
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

// On-demand integrity verification (Admin, Investigator, Auditor)
router.post('/:evidenceId/verify', integrityController.verifyEvidence);

// Chain of custody timeline (Admin, Investigator, Auditor)
router.get('/:evidenceId/custody', integrityController.getCustody);

// Integrity check history
router.get('/:evidenceId/integrity-history', integrityController.getIntegrityHistory);

// PDF report export
router.get('/:evidenceId/report', evidenceController.generateEvidenceReport);

module.exports = router;
