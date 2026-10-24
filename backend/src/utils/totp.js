const crypto = require('crypto');

/**
 * RFC 6238 TOTP and RFC 4648 Base32 implementation using Node.js crypto
 */
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(base32Str) {
  const cleanStr = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const val = BASE32_CHARS.indexOf(cleanStr[i]);
    if (val === -1) {
      throw new Error(`Invalid Base32 character: ${cleanStr[i]}`);
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generate a random Base32 secret for TOTP (160 bits / 20 bytes standard)
 */
function generateSecret(length = 20) {
  const buffer = crypto.randomBytes(length);
  return base32Encode(buffer);
}

/**
 * Calculate TOTP token for a given counter
 */
function generateTOTP(secretBase32, timeStepSeconds = 30, digits = 6, timestampMs = Date.now()) {
  const secretKey = base32Decode(secretBase32);
  const counter = Math.floor(timestampMs / 1000 / timeStepSeconds);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secretKey);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
  return otp;
}

/**
 * Verify TOTP token with time window tolerance
 */
function verifyTOTP(token, secretBase32, windowSteps = 1, timeStepSeconds = 30, timestampMs = Date.now()) {
  if (!token || !secretBase32) return false;
  const cleanToken = String(token).trim();

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const checkTime = timestampMs + offset * timeStepSeconds * 1000;
    const generated = generateTOTP(secretBase32, timeStepSeconds, 6, checkTime);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(generated))) {
      return true;
    }
  }

  return false;
}

/**
 * Generate standard otpauth URL for QR codes / authenticator setup
 */
function generateOtpauthUri({ secret, issuer = 'EvidenceVault', accountName = 'user@demo.vault' }) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateOtpauthUri,
  base32Encode,
  base32Decode
};
