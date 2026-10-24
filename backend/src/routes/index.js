const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

// Mount system health
router.use('/', healthRoutes);

// Placeholder endpoints returning standard 501 for phases 2-5
router.use('/auth', (req, res) => res.status(501).json({ error: { message: 'Auth module scheduled for Phase 2', code: 'NOT_IMPLEMENTED' } }));
router.use('/users', (req, res) => res.status(501).json({ error: { message: 'Users module scheduled for Phase 2', code: 'NOT_IMPLEMENTED' } }));
router.use('/evidence', (req, res) => res.status(501).json({ error: { message: 'Evidence module scheduled for Phase 3/4', code: 'NOT_IMPLEMENTED' } }));
router.use('/access-requests', (req, res) => res.status(501).json({ error: { message: 'Access workflow scheduled for Phase 5', code: 'NOT_IMPLEMENTED' } }));
router.use('/audit-logs', (req, res) => res.status(501).json({ error: { message: 'Audit log module scheduled for Phase 4/5', code: 'NOT_IMPLEMENTED' } }));
router.use('/alerts', (req, res) => res.status(501).json({ error: { message: 'Alerts module scheduled for Phase 4/5', code: 'NOT_IMPLEMENTED' } }));
router.use('/backups', (req, res) => res.status(501).json({ error: { message: 'Backup module scheduled for Phase 5', code: 'NOT_IMPLEMENTED' } }));

// 404 for unmapped API endpoints
router.use('*', (req, res) => {
  res.status(404).json({
    error: {
      message: `API route not found: ${req.method} ${req.originalUrl}`,
      code: 'ROUTE_NOT_FOUND'
    }
  });
});

module.exports = router;
