# Backup and Recovery Procedures

## 1. Scope of Backups
The digital evidence vault maintains dual-layer storage:
1. **Relational & Document Metadata**: MongoDB Atlas automated snapshots & `mongodump` archive jobs.
2. **Object Files**: Versioned Amazon S3 bucket with Cross-Region Replication (CRR) and Object Lock (WORM).

## 2. Backup Execution
- **Daily Automated Backup**: Scheduled job takes a snapshot of MongoDB metadata, exports audit log checksums.
- **Manual Backups**: Triggered by Administrators via `POST /api/backups/run`.
- **Audit Safeguards**: Every backup execution records a job entry in the `backupJobs` collection.

## 3. Restore and Recovery Verification
1. Restore MongoDB collections to a clean testing or recovery database.
2. Reconcile records in `evidenceVersions` against object keys in Amazon S3.
3. Execute integrity verification on restored objects:
   - Stream bytes from S3.
   - Recalculate SHA-256.
   - Compare with `evidenceVersions.sha256`.
   - Verify digital signatures on canonical manifests.
4. Record recovery verification results and timestamp.
