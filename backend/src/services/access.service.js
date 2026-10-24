const { AccessRequest } = require('../models');
const { isMemoryMode, getMemoryStore } = require('../config/database');
const AuditService = require('./audit.service');
const CustodyService = require('./custody.service');

class AccessService {
  /**
   * Submit an access request for restricted evidence
   */
  static async createRequest({ evidenceId, reason, requestedDuration = 8, user, correlationId }) {
    if (!evidenceId || !reason) {
      const err = new Error('Evidence ID and operational justification reason are required.');
      err.status = 400;
      throw err;
    }

    const durationHours = Math.min(Math.max(parseInt(requestedDuration, 10) || 8, 1), 72);

    const requestData = {
      evidenceId,
      requesterId: user._id || user.id,
      reason,
      requestedDuration: durationHours,
      decision: 'PENDING',
      reviewerId: null,
      decisionReason: '',
      createdAt: new Date(),
      decidedAt: null,
      expiresAt: null,
      revokedAt: null
    };

    let savedRequest;
    if (isMemoryMode()) {
      const store = getMemoryStore('accessrequests');
      const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      savedRequest = { _id: id, id, ...requestData };
      store.set(id, savedRequest);
    } else {
      savedRequest = await AccessRequest.create(requestData);
    }

    await CustodyService.recordEvent({
      evidenceId,
      versionNumber: 1,
      actorId: user._id || user.id,
      action: 'VIEW_METADATA',
      result: 'SUCCESS',
      reason: `Submitted access request for ${durationHours} hours. Reason: ${reason}`,
      correlationId
    });

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'ACCESS_REQUEST_SUBMITTED',
      targetType: 'ACCESS_REQUEST',
      targetId: String(savedRequest._id || savedRequest.id),
      result: 'SUCCESS',
      correlationId,
      safeContext: { evidenceId, requestedDuration: durationHours }
    });

    return savedRequest;
  }

  /**
   * List access requests (Admin sees all; users see own or reviewable)
   */
  static async listRequests({ status, user, page = 1, limit = 20 } = {}) {
    if (isMemoryMode()) {
      const store = getMemoryStore('accessrequests');
      let items = Array.from(store.values());

      if (user && user.role !== 'admin') {
        // Investigators see their own requests
        items = items.filter(r => String(r.requesterId) === String(user._id || user.id));
      }

      if (status) {
        items = items.filter(r => r.decision === status);
      }

      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const skip = (page - 1) * limit;
      return {
        requests: items.slice(skip, skip + limit),
        total: items.length,
        page,
        limit
      };
    }

    const filter = {};
    if (user && user.role !== 'admin') {
      filter.requesterId = user._id || user.id;
    }
    if (status) {
      filter.decision = status;
    }

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      AccessRequest.find(filter)
        .populate('requesterId', 'email role')
        .populate('reviewerId', 'email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AccessRequest.countDocuments(filter)
    ]);

    return { requests, total, page, limit };
  }

  /**
   * Approve access request (Self-approval strictly prevented!)
   */
  static async approveRequest({ requestId, reviewer, decisionReason = '', correlationId }) {
    let request;
    if (isMemoryMode()) {
      const store = getMemoryStore('accessrequests');
      request = store.get(String(requestId));
    } else {
      request = await AccessRequest.findById(requestId);
    }

    if (!request) {
      const err = new Error('Access request not found.');
      err.status = 404;
      throw err;
    }

    if (request.decision !== 'PENDING') {
      const err = new Error(`Cannot approve request with current status '${request.decision}'.`);
      err.status = 400;
      throw err;
    }

    // CRITICAL SECURITY RULE: Prevent self-approval
    const requesterIdStr = String(request.requesterId._id || request.requesterId);
    const reviewerIdStr = String(reviewer._id || reviewer.id);
    if (requesterIdStr === reviewerIdStr) {
      const err = new Error('Self-approval violation: You cannot approve your own access request.');
      err.status = 403;
      err.code = 'SELF_APPROVAL_FORBIDDEN';
      throw err;
    }

    const durationHours = request.requestedDuration || 8;
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);
    const decidedAt = new Date();

    const updates = {
      decision: 'APPROVED',
      reviewerId: reviewer._id || reviewer.id,
      decisionReason: decisionReason || 'Authorized by Administrator',
      decidedAt,
      expiresAt,
      revokedAt: null
    };

    let updatedRequest;
    if (isMemoryMode()) {
      Object.assign(request, updates);
      const store = getMemoryStore('accessrequests');
      store.set(String(requestId), request);
      updatedRequest = request;
    } else {
      updatedRequest = await AccessRequest.findByIdAndUpdate(requestId, updates, { returnDocument: 'after' });
    }

    await CustodyService.recordEvent({
      evidenceId: request.evidenceId,
      versionNumber: 1,
      actorId: reviewer._id || reviewer.id,
      action: 'VIEW_METADATA',
      result: 'SUCCESS',
      reason: `Access approved for ${durationHours} hours until ${expiresAt.toISOString()}.`,
      correlationId
    });

    await AuditService.log({
      actorId: reviewer._id || reviewer.id,
      action: 'ACCESS_REQUEST_APPROVED',
      targetType: 'ACCESS_REQUEST',
      targetId: String(requestId),
      result: 'SUCCESS',
      correlationId,
      safeContext: { evidenceId: request.evidenceId, durationHours, expiresAt }
    });

    return updatedRequest;
  }

  /**
   * Reject access request
   */
  static async rejectRequest({ requestId, reviewer, decisionReason, correlationId }) {
    let request;
    if (isMemoryMode()) {
      const store = getMemoryStore('accessrequests');
      request = store.get(String(requestId));
    } else {
      request = await AccessRequest.findById(requestId);
    }

    if (!request) {
      const err = new Error('Access request not found.');
      err.status = 404;
      throw err;
    }

    // Prevent self-rejection confusion as well
    const requesterIdStr = String(request.requesterId._id || request.requesterId);
    const reviewerIdStr = String(reviewer._id || reviewer.id);
    if (requesterIdStr === reviewerIdStr) {
      const err = new Error('Self-review violation: You cannot reject your own access request.');
      err.status = 403;
      err.code = 'SELF_APPROVAL_FORBIDDEN';
      throw err;
    }

    const updates = {
      decision: 'REJECTED',
      reviewerId: reviewer._id || reviewer.id,
      decisionReason: decisionReason || 'Denied by Reviewer',
      decidedAt: new Date()
    };

    let updatedRequest;
    if (isMemoryMode()) {
      Object.assign(request, updates);
      const store = getMemoryStore('accessrequests');
      store.set(String(requestId), request);
      updatedRequest = request;
    } else {
      updatedRequest = await AccessRequest.findByIdAndUpdate(requestId, updates, { returnDocument: 'after' });
    }

    await AuditService.log({
      actorId: reviewer._id || reviewer.id,
      action: 'ACCESS_REQUEST_REJECTED',
      targetType: 'ACCESS_REQUEST',
      targetId: String(requestId),
      result: 'DENIED',
      correlationId,
      safeContext: { evidenceId: request.evidenceId, decisionReason }
    });

    return updatedRequest;
  }

  /**
   * Revoke active approved access
   */
  static async revokeRequest({ requestId, reviewer, correlationId }) {
    let request;
    if (isMemoryMode()) {
      const store = getMemoryStore('accessrequests');
      request = store.get(String(requestId));
    } else {
      request = await AccessRequest.findById(requestId);
    }

    if (!request) {
      const err = new Error('Access request not found.');
      err.status = 404;
      throw err;
    }

    const updates = {
      decision: 'REVOKED',
      revokedAt: new Date()
    };

    let updatedRequest;
    if (isMemoryMode()) {
      Object.assign(request, updates);
      const store = getMemoryStore('accessrequests');
      store.set(String(requestId), request);
      updatedRequest = request;
    } else {
      updatedRequest = await AccessRequest.findByIdAndUpdate(requestId, updates, { returnDocument: 'after' });
    }

    await AuditService.log({
      actorId: reviewer._id || reviewer.id,
      action: 'ACCESS_REQUEST_REVOKED',
      targetType: 'ACCESS_REQUEST',
      targetId: String(requestId),
      result: 'SUCCESS',
      correlationId,
      safeContext: { evidenceId: request.evidenceId }
    });

    return updatedRequest;
  }

  /**
   * Check if a user currently holds active, non-expired, non-revoked approved access
   */
  static async checkActiveAccess({ evidenceId, userId }) {
    const now = new Date();
    if (isMemoryMode()) {
      const store = getMemoryStore('accessrequests');
      const active = Array.from(store.values()).find(r =>
        r.evidenceId === evidenceId &&
        String(r.requesterId) === String(userId) &&
        r.decision === 'APPROVED' &&
        r.expiresAt && new Date(r.expiresAt) > now &&
        !r.revokedAt
      );
      return !!active;
    }

    const active = await AccessRequest.findOne({
      evidenceId,
      requesterId: userId,
      decision: 'APPROVED',
      expiresAt: { $gt: now },
      revokedAt: null
    });

    return !!active;
  }
}

module.exports = AccessService;
