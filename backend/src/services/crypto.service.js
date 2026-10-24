const crypto = require('crypto');
const config = require('../config');

// Auto-generate active Ed25519 keypair if not configured in environment
let activeKeyPair = null;

function getKeyPair() {
  if (!activeKeyPair) {
    if (config.signingPrivateKey && config.signingPublicKey) {
      activeKeyPair = {
        keyId: config.signingKeyId || 'vault-ed25519-key-01',
        algorithm: 'Ed25519',
        privateKey: config.signingPrivateKey,
        publicKey: config.signingPublicKey
      };
    } else {
      // Deterministic / secure Ed25519 key generation
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
      activeKeyPair = {
        keyId: config.signingKeyId || 'vault-ed25519-key-01',
        algorithm: 'Ed25519',
        privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        publicKey: publicKey.export({ type: 'spki', format: 'pem' })
      };
    }
  }
  return activeKeyPair;
}

/**
 * Deterministic JSON stringifier (canonical key ordering)
 */
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeJson).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  const entries = keys.map(k => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
  return '{' + entries.join(',') + '}';
}

class CryptoService {
  /**
   * Compute SHA-256 from buffer or string
   */
  static hashSha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Create a streaming SHA-256 hasher
   */
  static createSha256Stream() {
    return crypto.createHash('sha256');
  }

  /**
   * Build canonical manifest object
   */
  static buildManifest({
    evidenceId,
    versionNumber,
    s3Bucket,
    s3ObjectKey,
    s3ObjectVersionId,
    sha256,
    fileSize,
    originalFilename,
    detectedMimeType,
    timestamp
  }) {
    return {
      evidenceId,
      versionNumber,
      s3Bucket,
      s3ObjectKey,
      s3ObjectVersionId,
      sha256: sha256.toLowerCase(),
      fileSize,
      originalFilename,
      detectedMimeType,
      timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp
    };
  }

  /**
   * Sign canonical manifest with protected Ed25519 key
   */
  static signManifest(manifest) {
    const keyPair = getKeyPair();
    const canonicalString = canonicalizeJson(manifest);
    const signature = crypto.sign(null, Buffer.from(canonicalString), keyPair.privateKey);

    return {
      signature: signature.toString('base64'),
      signatureAlgorithm: keyPair.algorithm,
      signingKeyId: keyPair.keyId,
      canonicalString
    };
  }

  /**
   * Verify signature against canonical manifest using public key
   */
  static verifyManifestSignature(manifest, signatureBase64, publicKeyPem = null) {
    const keyPair = getKeyPair();
    const keyToUse = publicKeyPem || keyPair.publicKey;
    const canonicalString = canonicalizeJson(manifest);

    try {
      return crypto.verify(
        null,
        Buffer.from(canonicalString),
        keyToUse,
        Buffer.from(signatureBase64, 'base64')
      );
    } catch (err) {
      console.warn('[CryptoService] Signature verification exception:', err.message);
      return false;
    }
  }

  /**
   * Get active public key PEM and Key ID
   */
  static getPublicKeyInfo() {
    const keyPair = getKeyPair();
    return {
      keyId: keyPair.keyId,
      algorithm: keyPair.algorithm,
      publicKey: keyPair.publicKey
    };
  }
}

module.exports = CryptoService;
