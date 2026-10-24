const PDFDocument = require('pdfkit');
const EvidenceService = require('./evidence.service');
const CustodyService = require('./custody.service');
const IntegrityService = require('./integrity.service');
const CryptoService = require('./crypto.service');
const AuditService = require('./audit.service');

class PdfReportService {
  /**
   * Generate canonical PDF evidence report
   */
  static async generateReport({ evidenceId, versionNumber, user, correlationId }) {
    const evidence = await EvidenceService.getEvidenceById(evidenceId);
    if (!evidence) {
      const err = new Error(`Evidence record '${evidenceId}' not found.`);
      err.status = 404;
      throw err;
    }

    const versions = await EvidenceService.getEvidenceVersions(evidenceId);
    let targetVersion;
    if (versionNumber) {
      targetVersion = versions.find(v => String(v.versionNumber) === String(versionNumber));
    } else {
      targetVersion = versions[versions.length - 1]; // current version
    }

    if (!targetVersion) {
      const err = new Error(`Version '${versionNumber}' not found for evidence '${evidenceId}'.`);
      err.status = 404;
      throw err;
    }

    // Verify signature status
    const isSigValid = CryptoService.verifyManifestSignature(
      targetVersion.manifest,
      targetVersion.signature
    );

    // Fetch custody timeline & integrity check history
    const custodyTimeline = await CustodyService.getCustodyTimeline(evidenceId);
    const integrityHistory = await IntegrityService.getIntegrityCheckHistory(evidenceId);

    // Instantiate PDFKit document
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Document Header
    doc.fillColor('#0369a1').fontSize(18).text('DIGITAL EVIDENCE INTEGRITY & CUSTODY REPORT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fillColor('#64748b').fontSize(9).text('Cloud-Based Digital Evidence Vault — Cryptographic Verification Summary', { align: 'center' });
    doc.text('ACADEMIC DEMONSTRATION PLATFORM — SYNTHETIC DEMO EVIDENCE ONLY', { align: 'center' });
    doc.moveDown(1);

    // Horizontal Rule
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // 1. Evidence Overview
    doc.fillColor('#0f172a').fontSize(12).text('1. EVIDENCE SPECIMEN METADATA', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Evidence ID:          ${evidence.evidenceId}`);
    doc.text(`Title:                ${evidence.title}`);
    doc.text(`Case / Reference ID:  ${evidence.referenceId}`);
    doc.text(`Category:             ${evidence.category}`);
    doc.text(`Classification:       ${evidence.classification.toUpperCase()}`);
    doc.text(`Current Status:       ${evidence.status.toUpperCase()}`);
    doc.text(`Registered Timestamp: ${new Date(evidence.createdAt).toUTCString()}`);
    doc.moveDown(1);

    // 2. Cryptographic Manifest & Integrity Baseline
    doc.fillColor('#0f172a').fontSize(12).text(`2. SELECTED VERSION & CRYPTOGRAPHIC DIGEST (Version v${targetVersion.versionNumber})`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Original Filename:    ${targetVersion.originalFilename}`);
    doc.text(`File Size (Bytes):    ${targetVersion.fileSize.toLocaleString()} bytes`);
    doc.text(`MIME Type:            ${targetVersion.detectedMimeType}`);
    doc.text(`S3 Object Version ID: ${targetVersion.s3ObjectVersionId}`);
    doc.moveDown(0.3);
    doc.text(`Hash Algorithm:       ${targetVersion.hashAlgorithm || 'SHA-256'}`);
    doc.font('Courier').fontSize(9).text(`SHA-256 Digest:       ${targetVersion.sha256}`);
    doc.font('Helvetica').fontSize(10);
    doc.moveDown(0.3);
    doc.text(`Signature Algorithm:  ${targetVersion.signatureAlgorithm || 'Ed25519'}`);
    doc.text(`Signing Key ID:       ${targetVersion.signingKeyId}`);
    doc.text(`Signature Status:     ${isSigValid ? 'VALID (Deterministic Manifest Signature Verified)' : 'INVALID / TAMPERED'}`);
    doc.moveDown(1);

    // 3. Chain of Custody Timeline
    doc.fillColor('#0f172a').fontSize(12).text('3. IMMUTABLE CHAIN-OF-CUSTODY TIMELINE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    if (custodyTimeline.length === 0) {
      doc.fillColor('#64748b').text('No custody events logged.');
    } else {
      custodyTimeline.forEach((event, idx) => {
        const timeStr = new Date(event.timestamp).toISOString();
        const actorStr = event.actorId ? (event.actorId.email || event.actorId) : (event.systemActor || 'system');
        doc.fillColor('#0f172a').text(`${idx + 1}. [${timeStr}] ${event.action} - Result: ${event.result}`);
        doc.fillColor('#475569').text(`   Actor: ${actorStr} | Version: v${event.versionNumber} | ${event.reason || 'Standard operation'}`);
        doc.moveDown(0.3);
      });
    }
    doc.moveDown(1);

    // 4. Integrity Checks History
    doc.fillColor('#0f172a').fontSize(12).text('4. RECENT INTEGRITY CHECK LOGS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9);

    if (integrityHistory.length === 0) {
      doc.fillColor('#64748b').text('No on-demand verification checks recorded.');
    } else {
      integrityHistory.slice(0, 5).forEach((chk, idx) => {
        const timeStr = new Date(chk.checkedAt).toISOString();
        doc.fillColor('#0f172a').text(`Check ${idx + 1}: [${timeStr}] v${chk.versionNumber} Verdict: ${chk.result}`);
        doc.fillColor('#475569').text(`   Calculated Hash: ${chk.calculatedSha256.substring(0, 32)}... (Match: ${chk.hashMatch})`);
        doc.moveDown(0.3);
      });
    }

    // Document Footer
    doc.moveDown(2);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#64748b').fontSize(8).text(`Report Generated On: ${new Date().toUTCString()} | Requested By: ${user.email} (${user.role.toUpperCase()}) | Correlation ID: ${correlationId || 'N/A'}`, { align: 'center' });

    // Finalize PDF stream
    doc.end();

    // Record custody event & audit log
    await CustodyService.recordEvent({
      evidenceId,
      versionNumber: targetVersion.versionNumber,
      actorId: user._id || user.id,
      action: 'REPORT_GENERATED',
      result: 'SUCCESS',
      reason: `Generated signed PDF evidence report for version v${targetVersion.versionNumber}.`,
      correlationId
    });

    await AuditService.log({
      actorId: user._id || user.id,
      action: 'EVIDENCE_REPORT_EXPORTED',
      targetType: 'EVIDENCE',
      targetId: evidenceId,
      result: 'SUCCESS',
      correlationId,
      safeContext: { versionNumber: targetVersion.versionNumber }
    });

    return {
      docStream: doc,
      filename: `Evidence_Report_${evidenceId}_v${targetVersion.versionNumber}.pdf`
    };
  }
}

module.exports = PdfReportService;
