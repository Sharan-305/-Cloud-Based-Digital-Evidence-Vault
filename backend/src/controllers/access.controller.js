const AccessService = require('../services/access.service');

async function createRequest(req, res, next) {
  try {
    const { evidenceId, reason, requestedDuration } = req.body;
    const request = await AccessService.createRequest({
      evidenceId,
      reason,
      requestedDuration,
      user: req.user,
      correlationId: req.correlationId
    });

    res.status(201).json({
      message: 'Access request submitted successfully. Awaiting Administrator review.',
      request
    });
  } catch (err) {
    next(err);
  }
}

async function listRequests(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await AccessService.listRequests({
      status,
      user: req.user,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10)
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function approveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { decisionReason } = req.body;

    const request = await AccessService.approveRequest({
      requestId: id,
      reviewer: req.user,
      decisionReason,
      correlationId: req.correlationId
    });

    res.status(200).json({
      message: 'Access request approved. Time-bound access grant is active.',
      request
    });
  } catch (err) {
    next(err);
  }
}

async function rejectRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { decisionReason } = req.body;

    const request = await AccessService.rejectRequest({
      requestId: id,
      reviewer: req.user,
      decisionReason,
      correlationId: req.correlationId
    });

    res.status(200).json({
      message: 'Access request rejected.',
      request
    });
  } catch (err) {
    next(err);
  }
}

async function revokeRequest(req, res, next) {
  try {
    const { id } = req.params;

    const request = await AccessService.revokeRequest({
      requestId: id,
      reviewer: req.user,
      correlationId: req.correlationId
    });

    res.status(200).json({
      message: 'Access grant revoked.',
      request
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRequest,
  listRequests,
  approveRequest,
  rejectRequest,
  revokeRequest
};
