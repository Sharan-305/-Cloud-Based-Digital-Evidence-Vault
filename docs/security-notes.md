# Security Architecture & Operational Notes

## 1. Security Baseline & Constraints
- **Private S3 Bucket**: Public access is blocked at the bucket and account level (`BlockPublicAcls`, `IgnorePublicAcls`, `BlockPublicPolicy`, `RestrictPublicBuckets`).
- **No Direct S3 Links**: The client is never given persistent public URLs. Files are accessed strictly through short-lived (e.g. 5-minute) pre-signed download URLs or authenticated proxy streams after checking role and active approval tokens.
- **Backend Authorization**: The frontend interface adjusts controls based on current session roles, but all security guarantees are strictly enforced on the backend via Express middleware (`authenticate`, `requireRole`, `enforceObjectAccess`).
- **Self-Approval Prevention**: Investigators cannot approve their own access requests under any circumstance.
- **Manifest Immutability**: Evidence manifests are signed deterministically (canonical JSON ordering). Modifying any property invalidates the cryptographic signature.
- **Redaction of Sensitive Details**: Password hashes, MFA secrets, S3 access credentials, and raw evidence contents are excluded from audit logs and application debug logs.

## 2. Limitations & Disclaimers
- Matching SHA-256 confirms byte integrity against the intake baseline; it does not vouch for original real-world provenance prior to upload.
- This application is an educational and academic vault demonstration.
