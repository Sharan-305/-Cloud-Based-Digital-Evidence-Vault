# REST API Documentation

## Base URL
`/api`

## Authentication Endpoints
- `POST /api/auth/register` — Register a new account (initiates inactive state pending admin approval).
- `POST /api/auth/verify-email` — Verify email token.
- `POST /api/auth/login` — Authenticate credentials, initiates MFA challenge.
- `POST /api/auth/mfa/verify` — Verify TOTP / MFA code and issue session token / HttpOnly cookie.
- `POST /api/auth/logout` — Invalidate session.
- `POST /api/auth/forgot-password` — Generate secure password reset token.
- `POST /api/auth/reset-password` — Reset password using token.

## User Management (Admin Only)
- `GET /api/users/me` — Current authenticated user profile.
- `GET /api/users` — List system users with pagination and role filters.
- `PATCH /api/users/:id/status` — Activate, suspend, or disable account.
- `PATCH /api/users/:id/role` — Update role assignment.

## Evidence Management
- `GET /api/evidence` — List evidence records (search, category, status, pagination).
- `POST /api/evidence` — Upload new evidence item with metadata and compute SHA-256 stream.
- `GET /api/evidence/:evidenceId` — Get metadata and current version details.
- `GET /api/evidence/:evidenceId/versions` — Get complete version list.
- `POST /api/evidence/:evidenceId/versions` — Upload an authorized new version.
- `POST /api/evidence/:evidenceId/verify` — Run on-demand SHA-256 and digital signature check.
- `GET /api/evidence/:evidenceId/custody` — Retrieve chain-of-custody history for evidence.
- `GET /api/evidence/:evidenceId/report` — Stream/download canonical PDF evidence report.
- `GET /api/evidence/:evidenceId/download` — Temporary pre-signed or proxied download after authorization verification.

## Access Requests
- `POST /api/access-requests` — Submit request for restricted evidence download.
- `GET /api/access-requests` — View user's requests or pending approvals queue.
- `POST /api/access-requests/:id/approve` — Approve request with duration (self-approval prohibited).
- `POST /api/access-requests/:id/reject` — Reject request with logged reason.
- `POST /api/access-requests/:id/revoke` — Revoke active access grant before expiration.

## Auditing, Alerts & System Health
- `GET /api/audit-logs` — Read-only system audit events.
- `GET /api/alerts` — Retrieve integrity and security alerts.
- `PATCH /api/alerts/:id/resolve` — Mark alert as investigated and resolved.
- `GET /api/backups/status` — Review metadata backup history.
- `POST /api/backups/run` — Run manual backup job (Admin only).
- `GET /api/health` — System status, database connectivity, and S3 reachability.
