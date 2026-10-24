# Data Flow Specifications

## 1. Evidence Intake Data Flow

```
User (Investigator)           Express API                      AWS S3               MongoDB Atlas
       |                           |                              |                       |
       |-- 1. Upload Form -------->|                              |                       |
       |   (File + Metadata)       |-- 2. Validate MIME/Ext       |                       |
       |                           |-- 3. Calculate SHA-256 Stream|                       |
       |                           |-- 4. PutObject (Key, bytes)->|                       |
       |                           |<-- VersionId returned -------|                       |
       |                           |-- 5. Build Canonical Manifest                        |
       |                           |-- 6. Sign Manifest (Ed25519)                         |
       |                           |-- 7. Persist Evidence & Version Record ------------->|
       |                           |-- 8. Record CustodyEvent (INTAKE) ------------------>|
       |                           |-- 9. AuditLog (EVIDENCE_CREATED) ------------------->|
       |<-- 10. Intake Success ----|                                                      |
```

## 2. Integrity Verification Data Flow

```
User (Investigator/Auditor)    Express API                      AWS S3               MongoDB Atlas
       |                            |                              |                       |
       |-- 1. Trigger Verify ------>|                              |                       |
       |   (EvidenceId, Version)    |-- 2. Fetch Stored Baseline Metadata ---------------->|
       |                            |-- 3. GetObject(Key, Version)->|                      |
       |                            |<-- Byte Stream --------------|                      |
       |                            |-- 4. Compute SHA-256 Digest                          |
       |                            |-- 5. Compare Calculated with Baseline SHA-256        |
       |                            |-- 6. Verify Manifest Signature with Public Key       |
       |                            |-- 7. If Mismatch: Create Tamper Alert -------------->|
       |                            |-- 8. Store IntegrityCheck Record -------------------->|
       |                            |-- 9. Record CustodyEvent (VERIFY) ------------------>|
       |<-- 10. Verification Result-|                                                      |
```
