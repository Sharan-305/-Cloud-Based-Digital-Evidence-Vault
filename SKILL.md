---
name: cloud-digital-evidence-vault-design-and-build
version: 1.0
description: Project-specific build and UI review rules for the Cloud-Based Digital Evidence Vault. Apply these instructions before creating or editing project files.
---

# Cloud-Based Digital Evidence Vault — Project Skill

## 1. Project context

- Product: secure web application for storing, tracking, verifying, and retrieving digital evidence.
- Frontend: HTML, CSS, Vanilla JavaScript.
- Backend: Node.js and Express.
- Metadata database: MongoDB Atlas.
- Evidence object storage: private Amazon S3.
- Deployment: Docker on an AWS virtual machine.
- Authentication: email/password plus MFA.
- Roles: Administrator, Evidence Investigator, Auditor.
- Integrity: SHA-256 per evidence version and digital signatures over canonical evidence manifests.
- Required workflows: chain of custody, audit logs, approval-based access, expiry/revocation, version history, tamper alerts, PDF reports, backup and recovery.
- Use synthetic demo data only. Do not add AI features.

## 2. How to use this skill

1. Read this file before making UI or frontend changes.
2. Read the project master prompt for the complete functional and security requirements.
3. Identify the page's primary user task and the role permitted to perform it.
4. Apply the design review principles below.
5. Check accessibility and responsive behavior.
6. Test loading, empty, success, error, denied, and confirmation states where relevant.
7. Report what was checked, what was changed, and any unresolved issues. Do not claim a test or accessibility check was performed if it was not.

## 3. Design principles adapted from Apple Design Skill

The original Apple Design Skill emphasizes purpose, agency, responsibility, familiarity, flexibility, simplicity, craft, and delight. Apply those general principles to this web application, but do not blindly copy iOS/macOS-only conventions.

### Purpose
- Make the primary task of each page obvious.
- Put the most important evidence status and next action where users can find them quickly.
- Use page titles and action labels that describe the actual task.

### Agency
- Explain what will happen before sensitive actions.
- Allow cancellation when safe and practical.
- Provide recovery guidance for validation errors and failed uploads.
- Do not discard form input unnecessarily after a recoverable error.

### Responsibility
- Explain why access is requested and what approval means.
- Show expiry and revocation status clearly.
- Confirm sensitive or destructive actions.
- Never expose confidential evidence or credentials through UI messages, URLs, logs, or frontend source.

### Familiarity
- Use consistent web conventions for navigation, forms, tables, pagination, search, dialogs, and notifications.
- Keep button wording and status names consistent throughout the application.
- Do not use Apple-specific tab bars, menus, or materials unless they genuinely fit the web product.

### Flexibility
- Support desktop, tablet, and mobile widths.
- Keep forms, tables, and evidence details usable on narrow screens.
- Support keyboard-only interaction and browser zoom.
- Avoid layouts that rely on a fixed viewport width.

### Simplicity
- Prioritize evidence identity, integrity state, custody history, permissions, and next actions.
- Avoid unnecessary decoration, excessive glass effects, heavy blur, and distracting animation.
- Keep dense metadata readable with grouping, labels, and whitespace.

### Craft
- Maintain consistent spacing, alignment, typography, colors, border styles, and interaction states.
- Make hover, focus, disabled, loading, success, warning, and error states intentional.
- Ensure icon buttons have accessible names and visible tooltips where useful.

### Delight
- Use restrained, professional polish suitable for a security product.
- Use animation only when it clarifies a state transition and does not interfere with access or readability.
- Never allow visual effects to weaken trust, legibility, or task completion.

## 4. Accessibility rules

- Use semantic HTML elements and correct heading order.
- Provide visible labels for inputs; do not use placeholder text as the only label.
- Ensure all interactive elements can be used with a keyboard.
- Provide visible focus indicators.
- Do not communicate status using color alone. Include text and/or accessible icons.
- Use readable text sizes and adequate contrast.
- Give icon-only controls accessible names.
- Associate validation messages with the relevant input.
- Announce important asynchronous status changes accessibly where practical.
- Respect reduced-motion preferences.
- Do not claim WCAG compliance or specific contrast ratios unless tested.

## 5. Security-aware UI rules

- The frontend is not a security boundary. Every protected operation must be authorized by the backend.
- Hide or disable actions the user cannot perform for usability, but still enforce authorization server-side.
- Do not put passwords, MFA codes, access tokens, signing keys, or AWS secrets in browser code.
- Do not use public S3 links or permanent evidence URLs.
- Show access approval status, expiry, and denial reasons without revealing restricted evidence metadata to unauthorized users.
- Ask for confirmation before deleting, revoking, or changing sensitive records.
- Avoid exposing stack traces or internal infrastructure details in errors.
- Do not display real confidential evidence in sample screens or screenshots.

## 6. Required page review checklist

For every page, check:

1. Page purpose is clear.
2. Current user role and allowed actions are respected.
3. Primary action is easy to identify.
4. Important status is expressed in text, not color alone.
5. Forms have labels, validation, and helpful error messages.
6. Loading, empty, success, failure, and access-denied states are handled.
7. Sensitive actions have appropriate confirmation.
8. Layout works on desktop and mobile widths.
9. Keyboard focus is visible and navigation order is logical.
10. Tables, filters, and pagination remain usable at small widths.
11. No secrets, private URLs, or confidential evidence appear in the frontend.
12. The page's implementation has been tested or any untested parts are clearly identified.

## 7. Page-specific priorities

- Login/MFA: clear labels, safe error messages, rate-limit feedback, recovery path.
- Dashboard: role-filtered summary, pending approvals, integrity results, unresolved alerts.
- Evidence register: search, filters, pagination, clear identity/version/status, permitted actions only.
- Evidence intake: supported file types, size limits, progress, validation, recoverable errors.
- Evidence details: Evidence ID, selected version, hash, signature status, custody timeline, access state.
- Access approval: reason, requested duration, reviewer decision, expiry, revocation, self-approval prevention.
- Integrity alerts: distinguish hash mismatch, signature failure, pending review, and resolved status.
- Audit log: readable, filterable, read-only presentation; never expose secrets.
- PDF reports: preview/export state, selected version, hash/signature results, custody events, report timestamp.
- User administration: account status, role, MFA status, confirmation for sensitive changes.
- Backup/recovery: last result, verification status, and actionable but non-sensitive error summaries.

## 8. Visual direction

- Use a calm, professional, security-focused visual language.
- Establish a consistent spacing scale, type scale, color tokens, and component states in CSS variables.
- Keep contrast and legibility above decorative effects.
- Use restrained colors for statuses and always pair them with labels.
- Prefer clear hierarchy and purposeful whitespace over crowded dashboards.
- Avoid copying Apple branding, logos, proprietary interface assets, or platform-only patterns.

## 9. Completion report format

At the end of a UI task, report:
- Files created or changed.
- Design principles applied.
- Accessibility checks actually performed.
- Responsive widths or devices actually checked.
- Tests actually run and results.
- Known limitations and next steps.

Never state that a feature, security control, accessibility check, or test is complete unless implementation or test evidence supports that statement.
