const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const evidenceRoutes = require('./evidence.routes');
const alertRoutes = require('./alert.routes');
const auditRoutes = require('./audit.routes');

const router = express.Router();

// Mount active system routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/alerts', alertRoutes);
router.use('/audit-logs', auditRoutes);

// Placeholder endpoints returning standard 501 for remaining phases
router.use('/access-requests', (req, res) => res.status(501).json({ error: { message: 'Access workflow scheduled for Phase 5', code: 'NOT_IMPLEMENTED' } }));
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
