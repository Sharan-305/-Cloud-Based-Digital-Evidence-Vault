const IntegrityService = require('../services/integrity.service');
const CustodyService = require('../services/custody.service');

async function verifyEvidence(req, res, next) {
  try {
    const { evidenceId } = req.params;
    const { versionNumber } = req.body || {};

    const report = await IntegrityService.verifyEvidenceVersion({
      evidenceId,
      versionNumber,
      user: req.user,
      correlationId: req.correlationId
    });

    res.status(200).json({
      message: report.result === 'VALID'
        ? 'Integrity verification succeeded: SHA-256 byte stream matches baseline and manifest signature verified.'
        : `Integrity check failed: ${report.result}. Tamper alert automatically created.`,
      report
    });
  } catch (err) {
    next(err);
  }
}

async function getCustody(req, res, next) {
  try {
    const { evidenceId } = req.params;
    const timeline = await CustodyService.getCustodyTimeline(evidenceId);
    res.status(200).json({ evidenceId, timeline });
  } catch (err) {
    next(err);
  }
}

async function getIntegrityHistory(req, res, next) {
  try {
    const { evidenceId } = req.params;
    const history = await IntegrityService.getIntegrityCheckHistory(evidenceId);
    res.status(200).json({ evidenceId, history });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  verifyEvidence,
  getCustody,
  getIntegrityHistory
};
