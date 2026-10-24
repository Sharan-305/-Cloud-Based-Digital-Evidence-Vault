# Cloud-Based Digital Evidence Vault

A secure, traceable web application for digital evidence intake, private cloud storage (Amazon S3), metadata tracking (MongoDB Atlas), cryptographic integrity verification (SHA-256 + digital signatures over canonical manifests), chain of custody tracking, role-based access management, and PDF report generation.

> **Academic Vault Notice**: This is an academic secure-vault project designed to demonstrate cryptographic integrity, access control, and chain of custody workflows. It is not an accredited legal forensic platform. Synthetic demo evidence only.

---

## Architecture Overview

- **Frontend**: Vanilla HTML5, CSS3 (custom responsive design system following project SKILL.md), Vanilla JavaScript (modular ES modules).
- **Backend**: Node.js with Express.js REST API.
- **Database**: MongoDB Atlas / local MongoDB (indexes on Evidence IDs, reference IDs, timestamps, users).
- **Object Storage**: Private Amazon S3 bucket with default encryption, Block Public Access, and versioning.
- **Integrity**: Exact-version SHA-256 hashing and Ed25519 canonical manifest signing/verification.
- **Authentication**: Email/password with MFA, role-based authorization (Administrator, Evidence Investigator, Auditor).
- **Containerization**: Docker & Docker Compose.

---

## Directory Structure

```text
cloud-digital-evidence-vault/
  SKILL.md               # UI/UX & security rules adapted from Apple Design principles
  README.md              # Project overview and setup instructions
  .gitignore             # Git exclusions
  .env.example           # Example configuration with placeholder values
  Dockerfile             # Multi-stage production container
  docker-compose.yml     # Local orchestration with MongoDB
  frontend/              # Semantic HTML5, CSS, and Vanilla JS UI
    index.html           # Landing / Gateway
    login.html           # Authentication / MFA / Reset
    dashboard.html       # Role-aware dashboard
    evidence.html        # Evidence register with search, filter, pagination
    evidence-details.html# Evidence details, versions, custody timeline
    access-requests.html # Access request & approval queue
    audit-logs.html      # Read-only audit log
    reports.html         # PDF evidence report generation
    users.html           # Administrator user & role management
    css/
      styles.css         # Design system tokens, components, accessibility
      responsive.css     # Responsive layouts & viewport breakpoints
    js/
      api.js             # Fetch wrapper with error handling & auth header
      auth.js            # Authentication & session state management
      dashboard.js       # Dashboard metrics & alerts
      evidence.js        # Evidence intake & register operations
      access-requests.js # Request submissions & review approvals
      reports.js         # Report export workflows
      users.js           # User administration
      ui.js              # UI utilities (modal, alerts, focus traps, notifications)
  backend/               # Node.js + Express.js API
    package.json
    src/
      server.js          # HTTP server listener and shutdown handlers
      app.js             # Express app setup, middleware, security headers
      config/            # Environment & database configuration
      routes/            # REST API route handlers
      controllers/       # Business logic controllers
      middleware/        # Auth, role-check, rate-limiting, error handling
      services/          # Storage, crypto, custody, pdf services
      models/            # MongoDB Mongoose schemas
      validators/        # Request validation schemas
      jobs/              # Reconciliation & backup tasks
      utils/             # Cryptographic helpers, canonical JSON, logger
    tests/               # Automated unit & integration tests
  docs/                  # Architecture, security, and schema documentation
  sample-data/           # Synthetic metadata & demo fixtures
  tests/                 # Acceptance checklist and testing notes
```

---

## Quickstart (Phase 1)

### Prerequisites

- Node.js >= 18.x (Tested with Node v22.x)
- npm >= 9.x
- Git

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   npm install
   ```

2. Copy the sample environment file and adjust variables:
   ```bash
   cp ../.env.example .env
   ```

3. Start the application in development mode:
   ```bash
   npm run dev
   ```

4. Or start in production mode:
   ```bash
   npm start
   ```

5. Access the application in your browser:
   - Frontend: `http://localhost:5000`
   - Healthcheck: `http://localhost:5000/api/health`

---

## Running Tests

From the `backend` directory:
```bash
npm test
```

---

## Phased Build Roadmap

- **Phase 1: Project Setup & Baseline Scaffolding** (Completed)
- **Phase 2: Database & Authentication (MongoDB Atlas, MFA, RBAC)**
- **Phase 3: Private S3 Storage & Upload State Machine**
- **Phase 4: Integrity Verification, Manifest Signatures & Chain of Custody**
- **Phase 5: Application Features & Workflows (Register, Approvals, Reports, Alerts)**
- **Phase 6: UI and Accessibility Review using SKILL.md**
- **Phase 7: End-to-End Testing & Acceptance Verification**
- **Phase 8: Docker & AWS VM Deployment**
