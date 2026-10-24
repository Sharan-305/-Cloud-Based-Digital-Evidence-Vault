# Database Schema Design (MongoDB Atlas)

## Collections & Key Indexes

### 1. `users`
- `_id`: ObjectId
- `email`: String (lowercase, trim, unique index)
- `passwordHash`: String (bcrypt/Argon2id)
- `role`: String enum (`['admin', 'investigator', 'auditor']`)
- `accountStatus`: String enum (`['pending', 'active', 'suspended', 'disabled']`)
- `emailVerified`: Boolean
- `mfaSecret`: String (encrypted)
- `mfaEnabled`: Boolean
- `createdAt`, `updatedAt`, `lastLoginAt`: Date

### 2. `evidence`
- `_id`: ObjectId
- `evidenceId`: String (unique index, formatted e.g. `EV-2026-XXXXX`)
- `title`: String
- `description`: String
- `category`: String (`documents`, `images`, `video`, `logs`, `forensic_archive`)
- `referenceId`: String (case ID, indexed)
- `tags`: Array of Strings (indexed)
- `classification`: String (`public`, `internal`, `confidential`, `restricted`)
- `createdBy`: ObjectId (ref: `users`)
- `currentVersionId`: ObjectId (ref: `evidenceVersions`)
- `status`: String (`intake_pending`, `active`, `archived`, `disposed`)
- `createdAt`, `updatedAt`: Date

### 3. `evidenceVersions`
- `evidenceId`: String (indexed)
- `versionNumber`: Number (1, 2, ...)
- `s3Bucket`: String
- `s3ObjectKey`: String (unique identifier key)
- `s3ObjectVersionId`: String (AWS S3 version id)
- `originalFilename`: String
- `detectedMimeType`: String
- `fileSize`: Number (bytes)
- `hashAlgorithm`: String ("SHA-256")
- `sha256`: String (hex lowercase)
- `manifest`: Object (canonical representation)
- `signature`: String (hex/base64 signature over manifest)
- `signatureAlgorithm`: String ("Ed25519")
- `signingKeyId`: String
- `uploadedBy`: ObjectId (ref: `users`)
- `uploadedAt`: Date

### 4. `custodyEvents`
- `evidenceId`: String (indexed)
- `versionNumber`: Number
- `actorId`: ObjectId (ref: `users`, optional if system)
- `systemActor`: String (optional)
- `action`: String (`INTAKE`, `VIEW_METADATA`, `DOWNLOAD`, `VERIFY`, `VERSION_ADDED`, `REPORT_GENERATED`)
- `timestamp`: Date (default: `Date.now`, indexed)
- `result`: String (`SUCCESS`, `FAILURE`, `TAMPER_DETECTED`)
- `reason`: String
- `correlationId`: String (UUID)
- `safeMetadata`: Object

### 5. `accessRequests`
- `evidenceId`: String (indexed)
- `requesterId`: ObjectId (ref: `users`, indexed)
- `reason`: String
- `requestedDuration`: Number (in hours)
- `decision`: String (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `REVOKED`)
- `reviewerId`: ObjectId (ref: `users`)
- `decisionReason`: String
- `createdAt`: Date
- `decidedAt`: Date
- `expiresAt`: Date
- `revokedAt`: Date

### 6. `integrityChecks`
- `evidenceId`: String (indexed)
- `versionNumber`: Number
- `expectedSha256`: String
- `calculatedSha256`: String
- `hashMatch`: Boolean
- `signatureValid`: Boolean
- `checkedBy`: ObjectId (ref: `users`)
- `checkedAt`: Date
- `result`: String (`VALID`, `MISMATCH_HASH`, `INVALID_SIGNATURE`)
- `correlationId`: String

### 7. `auditLogs`
- `actorId`: ObjectId
- `systemActor`: String
- `action`: String
- `targetType`: String
- `targetId`: String
- `timestamp`: Date (indexed)
- `result`: String
- `correlationId`: String
- `safeContext`: Object

### 8. `alerts`
- `evidenceId`: String
- `alertType`: String (`HASH_MISMATCH`, `SIGNATURE_FAIL`, `UNAUTHORIZED_ACCESS`, `INTEGRITY_VIOLATION`)
- `severity`: String (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `description`: String
- `status`: String (`OPEN`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`)
- `createdAt`: Date
- `resolvedBy`: ObjectId
- `resolvedAt`: Date
- `resolutionNotes`: String

### 9. `backupJobs`
- `jobType`: String (`SCHEDULED`, `MANUAL`)
- `startedAt`: Date
- `completedAt`: Date
- `status`: String (`RUNNING`, `COMPLETED`, `FAILED`)
- `backupReference`: String
- `verificationResult`: String
- `safeErrorSummary`: String
