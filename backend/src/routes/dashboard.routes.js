const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

// Aggregated operational metrics
router.get('/stats', dashboardController.getStats);

module.exports = router;
