const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Sign JWT session token
 */
function signSessionToken(payload, expiresIn = '8h') {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn,
    issuer: 'EvidenceVaultAPI',
    audience: 'EvidenceVaultUsers'
  });
}

/**
 * Verify JWT session token
 */
function verifySessionToken(token) {
  return jwt.verify(token, config.jwtSecret, {
    issuer: 'EvidenceVaultAPI',
    audience: 'EvidenceVaultUsers'
  });
}

/**
 * Generate secure random token and its SHA-256 hash
 * The plain token is sent to the user (e.g. email / reset link)
 * Only the SHA-256 hash is stored in the database.
 */
function generateOpaqueToken() {
  const plainToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
  return { plainToken, tokenHash };
}

/**
 * Hash an opaque token for DB lookup
 */
function hashOpaqueToken(plainToken) {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

module.exports = {
  signSessionToken,
  verifySessionToken,
  generateOpaqueToken,
  hashOpaqueToken
};
