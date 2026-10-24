const path = require('path');

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.tiff', '.tif',
  '.pdf',
  '.txt', '.log', '.csv', '.json',
  '.doc', '.docx',
  '.mp4', '.mov', '.avi',
  '.zip', '.tar', '.gz'
]);

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/tiff',
  'application/pdf',
  'text/plain', 'text/csv', 'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'application/zip', 'application/x-zip-compressed', 'application/x-tar', 'application/gzip'
]);

/**
 * Validate extension and initial bytes (magic numbers)
 */
function validateFileHeader(filename, detectedMimeType, headerChunk) {
  const ext = path.extname(filename || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File extension '${ext}' is not permitted in the evidence vault.`);
  }

  if (detectedMimeType && !ALLOWED_MIME_TYPES.has(detectedMimeType)) {
    throw new Error(`MIME type '${detectedMimeType}' is not permitted.`);
  }

  if (!headerChunk || headerChunk.length < 4) {
    // Too small for binary magic check, allowed if text/log
    return true;
  }

  const hex4 = headerChunk.slice(0, 4).toString('hex').toLowerCase();

  // Signature checks
  if (ext === '.pdf' && !headerChunk.toString('ascii', 0, 4).startsWith('%PDF')) {
    throw new Error('File signature mismatch: expected PDF document header.');
  }

  if ((ext === '.jpg' || ext === '.jpeg') && !hex4.startsWith('ffd8ff')) {
    throw new Error('File signature mismatch: expected JPEG image header.');
  }

  if (ext === '.png' && hex4 !== '89504e47') {
    throw new Error('File signature mismatch: expected PNG image header.');
  }

  if (ext === '.zip' && hex4 !== '504b0304' && hex4 !== '504b0506') {
    throw new Error('File signature mismatch: expected ZIP archive header.');
  }

  return true;
}

module.exports = {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  validateFileHeader
};
