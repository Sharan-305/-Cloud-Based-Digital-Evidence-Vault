const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const evidenceRoutes = require('./evidence.routes');
const alertRoutes = require('./alert.routes');
const auditRoutes = require('./audit.routes');
const accessRoutes = require('./access.routes');
const dashboardRoutes = require('./dashboard.routes');
const backupRoutes = require('./backup.routes');

const router = express.Router();

// Mount active system routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/evidence', evidenceRoutes);
router.use('/alerts', alertRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/access-requests', accessRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/backups', backupRoutes);

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
