# Cloud-Based Digital Evidence Vault

A secure, traceable web application for digital evidence intake, private cloud storage (Amazon S3), metadata tracking (MongoDB Atlas), cryptographic integrity verification (SHA-256 byte stream recalculation and Ed25519 digital signatures over canonical manifests), chain-of-custody tracking, role-based access management (Administrator, Evidence Investigator, Auditor), and verifiable PDF report generation.

> **Academic Vault Notice**: This application is an academic secure-vault demonstration designed to showcase cryptographic integrity, access control, and chain of custody workflows. It is not an accredited legal forensic platform. Synthetic demo evidence only. Strictly no AI features or automated evidence classification.

---

## Key Features & Security Architecture

1. **Deterministic Cryptographic Integrity**:
   - On intake, files are streamed to compute SHA-256 byte hashes and canonical JSON manifests.
   - Canonical manifests are digitally signed using Ed25519 asymmetric cryptography.
   - On-demand verification recalculates SHA-256 from exact version byte streams in S3 and verifies Ed25519 signatures.
   - Any byte mismatch immediately triggers a `CRITICAL` tamper alert and records a tamper event in the immutable custody log, strictly preserving baseline hashes.

2. **Private Amazon S3 Object Storage**:
   - S3 Versioning enabled for object immutability and history tracking.
   - Block Public Access enabled; objects are strictly private.
   - Pre-signed URLs or authorized stream proxies for time-bound access.
   - Server-Side Encryption (SSE-S3 / SSE-KMS).
   - Strict upload state machine (`INITIATED` -> `OBJECT_STORED` -> `HASHED` -> `METADATA_COMMITTED` -> `COMPLETE`) with automatic compensation and rollback on failure.

3. **Authentication & Role-Based Access Control (RBAC)**:
   - Email/password authentication with bcrypt hashing (12 salt rounds) and minimum password complexity.
   - RFC 6238 TOTP Multi-Factor Authentication (MFA) required for all roles.
   - Three segregated roles:
     - **Administrator**: User activation/status, role management, access approvals, tamper alert resolution, manual system backups. (Cannot intake evidence or alter chain of custody).
     - **Evidence Investigator**: Evidence intake, version uploads, inspection, access requests for restricted items.
     - **Auditor**: Read-only evidence inspection, custody timeline verification, system audit log review, PDF evidence report export. (Cannot modify data or download raw evidence files).
   - Self-approval prevention (`403 SELF_APPROVAL_FORBIDDEN`): Users cannot approve their own access requests.

4. **Immutable Chain of Custody & Audit Trail**:
   - Append-only `custodyEvents` collection capturing timestamp, actor ID, action type, version number, result, and correlation IDs.
   - Centralized read-only `auditLogs` collection recording system-wide activity, with raw credentials, MFA secrets, and sensitive tokens strictly sanitized.

5. **Apple-Inspired Design System (SKILL.md)**:
   - Custom Vanilla CSS design system built on Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity, Craft, Delight, and Accessibility.
   - Statuses communicated with text and distinct icons (`✓`, `✕`, `ℹ`, `◷`), never color alone.
   - Accessible confirmation dialogs with focus trap and Escape handler before sensitive actions (rejecting requests, approving access, suspending accounts).
   - High-contrast visible focus rings (`:focus-visible` with 3px outline) and skip links on all views.
   - Fully responsive design supporting mobile (`<=640px`) and tablet (`<=992px`) viewports.

---

## Directory Structure

```text
cloud-digital-evidence-vault/
  SKILL.md               # Apple-inspired UI/UX & security rules
  README.md              # Project documentation & operational runbook
  .gitignore             # Git exclusion rules
  .env.example           # Configuration template with placeholders
  Dockerfile             # Multi-stage production container
  docker-compose.yml     # Local multi-container orchestration (App + MongoDB)
  frontend/              # Semantic HTML5, CSS3, Vanilla JS UI
    index.html           # System Gateway & architectural overview
    login.html           # Authentication with password & TOTP MFA
    dashboard.html       # Role-aware metrics, alerts, and custody stream
    evidence.html        # Evidence register with search, filter, and intake
    evidence-details.html# Metadata, manifest, version history, custody timeline
    access-requests.html # Access approval queue with confirmation modals
    audit-logs.html      # Read-only tamper-evident audit journal
    reports.html         # Canonical PDF evidence report generator
    users.html           # Administrator user and role administration
    css/
      styles.css         # Design system tokens, components, modals, animations
      responsive.css     # Mobile & tablet layout breakpoints
    js/
      api.js             # Standardized fetch client with bearer auth & error handling
      auth.js            # Session state, login form, and MFA handling
      dashboard.js       # Dashboard metric aggregation & alert resolution
      evidence.js        # Register pagination, intake streaming, verification
      access-requests.js # Request submissions, approval/rejection confirmations
      reports.js         # Report selection & PDF streaming
      users.js           # User status & role management with confirmation dialogs
      audit-logs.js      # Audit log fetching and filtering
      ui.js              # Accessible modals, alert banners, badge renderers
  backend/               # Node.js with Express.js REST API
    package.json
    src/
      server.js          # HTTP server bootstrap and graceful shutdown
      app.js             # Express application setup, security headers, CORS
      config/            # Configuration and database connectivity
      controllers/       # Health, auth, user, evidence, integrity, access, dashboard, backup
      middleware/        # Auth, RBAC, requestLogger, authRateLimiter, errorHandler
      models/            # Mongoose schemas for User, Evidence, Version, Custody, Alert, etc.
      routes/            # Express REST route definitions
      services/          # Storage, crypto, custody, integrity, access, backup, pdfReport
      utils/             # TOTP generator, token utils, fileValidator, logger
    tests/               # Automated test suites
      health.test.js     # Baseline health, routing, and correlation ID suite (8 tests)
      auth.test.js       # Authentication, TOTP MFA, and RBAC suite (18 tests)
      storage.test.js    # S3 storage, MIME checks, and versioning suite (10 tests)
      integrity.test.js  # SHA-256 verification, Ed25519 signatures & tampering (10 tests)
      features.test.js   # Access approvals, reports, dashboard, backup (12 tests)
      e2e.test.js        # Comprehensive end-to-end acceptance suite (14 tests)
      run-all.js         # Sequential runner executing all 6 test suites
  docs/                  # Architecture, data flow, API, and database specifications
  sample-data/           # Synthetic metadata & fixture templates
  tests/                 # Acceptance checklist and testing verification records
```

---

## Local Development Quickstart

### Prerequisites

- **Node.js**: v18.x or v22.x (Tested on Node v22.23.2)
- **npm**: v9.x or v10.x
- **MongoDB**: Local MongoDB instance listening on `mongodb://localhost:27017` OR automated in-memory adapter fallback.

### Steps

1. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```

2. Copy the sample environment configuration:
   ```bash
   cp ../.env.example .env
   ```

3. Run the automated test suite to verify baseline integrity:
   ```bash
   npm test
   ```

4. Start the server in development mode:
   ```bash
   npm run dev
   ```

5. Access the application in your browser:
   - **Frontend UI**: `http://localhost:5000`
   - **Healthcheck Endpoint**: `http://localhost:5000/api/health`

---

## Containerized Deployment (Docker & Compose)

### Running with Docker Compose

To launch the Evidence Vault alongside an isolated MongoDB container:

```bash
docker compose up -d --build
```

- Application will be accessible at: `http://localhost:5000`
- MongoDB will be available internally within the bridge network on port 27017 with persistent volume storage (`mongo-data`).

### Building Production Docker Image

```bash
docker build -t cloud-digital-evidence-vault:latest .
```

Run the container individually:
```bash
docker run -d \
  -p 5000:5000 \
  --name evidence_vault \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/evidence_vault \
  -e SESSION_SECRET=production_strong_session_secret_min_32_chars \
  -e JWT_SECRET=production_strong_jwt_secret_min_32_chars \
  cloud-digital-evidence-vault:latest
```

---

## AWS VM / EC2 Production Deployment Runbook

### 1. Provisioning Cloud Infrastructure
1. Launch an **AWS EC2 instance** (Ubuntu 22.04 LTS, `t3.medium` or larger recommended).
2. Configure **Security Group**:
   - Inbound `443` (HTTPS) from allowed networks.
   - Inbound `80` (HTTP for Let's Encrypt challenge and redirection).
   - Inbound `22` (SSH) restricted to authorized administrative bastion hosts or AWS Systems Manager (SSM) Session Manager.
3. Attach an **IAM Instance Profile** with least-privilege permissions to the target S3 evidence bucket:
   - `s3:GetObject`, `s3:GetObjectVersion`, `s3:PutObject`, `s3:ListBucket`, `s3:ListBucketVersions`.
   - Explicitly deny `s3:DeleteObject` and `s3:DeleteObjectVersion` to prevent deletion of evidence artifacts.
4. Configure **S3 Bucket**:
   - Enable **Bucket Versioning**.
   - Enable **Block Public Access** (all 4 settings enabled).
   - Enable **Server-Side Encryption** (SSE-S3 or AWS KMS CMEK).

### 2. Application Setup on EC2 Host
1. Install Node.js (v22.x LTS) or Docker Engine:
   ```bash
   sudo apt update && sudo apt install -y curl git nginx
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. Clone repository and install dependencies:
   ```bash
   git clone <repository-url> /opt/cloud-digital-evidence-vault
   cd /opt/cloud-digital-evidence-vault/backend
   npm ci --omit=dev
   ```

3. Configure environment file `/opt/cloud-digital-evidence-vault/backend/.env`:
   - Set `NODE_ENV=production`.
   - Set `MONGODB_URI` pointing to MongoDB Atlas with TLS enabled (`+srv` connection string).
   - Set `AWS_S3_BUCKET_NAME` to your private production S3 bucket.
   - Generate strong cryptographically random strings for `JWT_SECRET` and `SESSION_SECRET`.

4. Configure systemd service `/etc/systemd/system/evidence-vault.service`:
   ```ini
   [Unit]
   Description=Cloud-Based Digital Evidence Vault
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/cloud-digital-evidence-vault/backend
   ExecStart=/usr/bin/node src/server.js
   Restart=always
   RestartSec=5
   Environment=NODE_ENV=production
   EnvironmentFile=/opt/cloud-digital-evidence-vault/backend/.env

   [Install]
   WantedBy=multi-user.target
   ```

5. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now evidence-vault
   ```

6. Configure Nginx Reverse Proxy with TLS:
   ```nginx
   server {
       listen 80;
       server_name vault.agency.gov;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name vault.agency.gov;

       ssl_certificate /etc/letsencrypt/live/vault.agency.gov/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/vault.agency.gov/privkey.pem;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;

       client_max_body_size 500M;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

---

## Automated Verification & Test Results

The vault incorporates a comprehensive automated test runner executing 6 dedicated test suites across 72 automated assertions:

| Test Suite | Scope | Tests | Result |
| :--- | :--- | :---: | :---: |
| `tests/health.test.js` | Baseline API healthcheck, routing, correlation IDs, static delivery | 8 | **PASS** |
| `tests/auth.test.js` | User registration, password complexity, RFC 6238 TOTP MFA, JWT auth, RBAC | 18 | **PASS** |
| `tests/storage.test.js` | S3 mock/live adapter, upload state machine, file signatures, versioning | 10 | **PASS** |
| `tests/integrity.test.js` | SHA-256 byte recalculation, Ed25519 manifest signatures, tamper alerts | 10 | **PASS** |
| `tests/features.test.js` | Access approval flow, self-approval prevention, signed PDF report, dashboard | 12 | **PASS** |
| `tests/e2e.test.js` | End-to-end acceptance across Admin, Investigator, and Auditor roles | 14 | **PASS** |
| **Total** | **Comprehensive Full System Verification** | **72** | **100% PASS** |

To execute all test suites:
```bash
cd backend
npm test
```

---

## Demo Credentials & Synthetic Testing Data

To test the application locally or in a sandbox environment, use the synthetic demo accounts:

- **Administrator**: `admin@demo.vault`
  - Password: `Password123!@#Vault`
  - MFA TOTP Secret: `JBSWY3DPEHPK3PXP` (generates standard 6-digit TOTP codes)
  - Privileges: User approvals & role management, access request review, tamper alert resolution, backup execution.

- **Evidence Investigator**: `investigator@demo.vault`
  - Password: `Password123!@#Vault`
  - MFA TOTP Secret: `JBSWY3DPEHPK3PXP`
  - Privileges: Evidence intake, multi-versioning, on-demand verification, access requests.

- **Auditor**: `auditor@demo.vault`
  - Password: `Password123!@#Vault`
  - MFA TOTP Secret: `JBSWY3DPEHPK3PXP`
  - Privileges: Read-only evidence inspection, custody timeline analysis, system audit log viewing, signed PDF report export.
