# Architecture Overview — Cloud-Based Digital Evidence Vault

## 1. High-Level Architecture

The Cloud-Based Digital Evidence Vault is designed with a clear separation of concerns, defense-in-depth, and an append-oriented custody model:

```
[ Web Browser Client ]
       | (HTTPS / TLS)
       v
[ Express.js API Gateway ]
       |-- Security Middleware (Helmet, CORS, Rate Limit, Auth, RBAC)
       |-- Static Assets Server (HTML5 / CSS3 / Vanilla JS)
       v
+-------------------------------+-------------------------------+
|                               |                               |
v                               v                               v
[ MongoDB Atlas ]      [ Private Amazon S3 ]       [ Cryptographic Subsystem ]
(Metadata, Custody,     (Versioned Bucket,          (SHA-256 Digest Engine,
 Audit, Users, Alerts)   Block Public Access,        Ed25519 Manifest Signer/
                         Server-Side Encryption)     Verifier)
```

## 2. Core Subsystems

### 2.1 Backend REST API
- Built with Node.js and Express.js.
- Strictly validates input schemas before passing data to services.
- Never stores raw sensitive credentials in logs or responses.
- Implements the upload state machine (`INITIATED` -> `OBJECT_STORED` -> `HASHED` -> `METADATA_COMMITTED` -> `COMPLETE`).

### 2.2 Storage & Versioning Subsystem
- Private Amazon S3 bucket with Object Versioning enabled.
- Server-Side Encryption with KMS or Amazon S3-managed keys (SSE-S3/SSE-KMS).
- Access control enforced via pre-signed short-lived URLs or streaming backend proxy with role validation.

### 2.3 Cryptographic Integrity Subsystem
- Computes SHA-256 hash stream during evidence ingestion.
- Forms a deterministic canonical JSON manifest of evidence metadata, version ID, timestamp, and digest.
- Signs the canonical manifest using Ed25519 / RSA protected private key.
- Recalculates hash from S3 version byte stream during verification checks and cross-references the signed manifest.

### 2.4 Chain of Custody & Audit Logging
- Immutable-oriented custody log: Every view, download, intake, verification, access request, and decision is recorded.
- System actor or user ID, timestamp, action, target, result, correlation ID, and safe context.
