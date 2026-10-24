const BackupService = require('../services/backup.service');

async function getBackupStatus(req, res, next) {
  try {
    const jobs = await BackupService.getBackupStatus();
    res.status(200).json({ jobs });
  } catch (err) {
    next(err);
  }
}

async function runBackup(req, res, next) {
  try {
    const job = await BackupService.runBackup({
      user: req.user,
      correlationId: req.correlationId
    });

    res.status(200).json({
      message: 'Backup job executed and verification completed successfully.',
      job
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBackupStatus,
  runBackup
};
