# Tebeka Portal — Complete User Service Business Logic Architecture v3.0

This document provides an exhaustive, production-grade specification of all business logic rules, domain state machines, event publishing structures, and API endpoints implemented across all 15 functional requirement modules in the **User Service** backend, fully compliant with **Tebeka Portal Development-Ready Documentation v3.0**.

---

## Technical Stack & Microservice Architecture

- **Framework**: NestJS (TypeScript) with Modular Domain Architecture.
- **Auth Engine**: Better Auth (`better-auth`) integrated via `@thallesp/nestjs-better-auth`.
- **Database Adapter**: `@better-auth/prisma-adapter` over PostgreSQL (`user_db`).
- **ORM & Data Storage**: Prisma ORM with `@prisma/client/user`.
- **Event Outbox Pattern**: Transactional `OutboxEvent` table writing domain events for RabbitMQ event dispatching.
- **Global Context**: Global route prefix `/api/v1`, global validation pipes, global exception filters, and `bodyParser: false` for Better Auth raw payload processing.

---

## 1. Authentication & Authorization Module (`/api/v1/auth`)

### 1.1 Multi-Persona Registration & Onboarding Rules
- **Account-Per-Role Rule (`ONE_PHONE_PER_ROLE`)**:
  - `Client`: Same phone + Client allowed once.
  - `Attorney`: Same phone + Attorney allowed once.
  - Same phone number CAN exist once for Client and once for Attorney under separate user accounts.
  - Duplicate registration for same phone + same role is strictly REJECTED (`PHONE_ROLE_DUPLICATE`).
- **Email & Phone Requirement Rules**:
  - `Client`: Email is optional; phone is required.
  - `Attorney`: Email is mandatory; phone is required.
  - `Phone Format`: Must strictly follow E.164 standard.
  - `OTP Mobile Prefixes`: Only Ethiopian mobile prefixes `+2519` and `+2517` are accepted for OTP generation.
- **OTP Continuation Token Gate**:
  - Verification endpoint (`POST /auth/otp/verify`) mints a scoped, single-use `otpContinuationToken` valid for 15 minutes.
  - Registration endpoints (`POST /auth/register/client`, `POST /auth/register/attorney`) MANDATORILY require `otpContinuationToken`. Unverified registrations are rejected.
- **Registration Endpoints**:
  - `Client Registration (POST /auth/register/client)`: Accepts `otpContinuationToken`, phone, optional email, password, optional marketing consent. Sets `status = ACTIVE` and fires `USER_CREATED`, `USER_ACTIVATED`.
  - `Attorney Registration (POST /auth/register/attorney)`: Accepts `otpContinuationToken`, phone, mandatory email, password, bar registration number. Provisions `ATTORNEY` role and atomically creates `AttorneyProfile` record in `DRAFT` status (`verificationStatus = DRAFT`). Fires `USER_CREATED`, `ATTORNEY_PROFILE_CREATED`.
  - `Admin Account Restriction`: Admin accounts can ONLY be created by a Super Admin (`POST /auth/register/admin`). No public self-registration path exists. Support accounts are provisioned by Admin/Super Admin.
  - `Invite Registration (POST /auth/register/invite)`: Validates single-use invite token and activates pre-configured persona.

### 1.2 Hard OTP Limits & Progressive Lockout
- **Hard OTP Business Rules**:
  - OTP Code: Exactly 6 numeric digits.
  - Validity: 5-minute TTL expiration.
  - Single-Use: Invalidated immediately upon first attempt (successful or max failed attempts).
  - Failed Attempt Limit: Maximum 3 failed OTP entries before code invalidation.
  - Resend Cooldown: Exactly 60-second cooldown between resend requests.
  - Hourly Rate Limit: Maximum 5 requests per hour per phone number. The 6th request within the hour is strictly REJECTED with `HTTP 429 Too Many Requests`.
- **Progressive Lockout Engine**:
  - Failed login attempts trigger progressive throttling per account AND per IP address.
  - Lockout thresholds: 5 failed attempts -> 15 min lock; 10 failed attempts -> 1 hour lock; 15 failed attempts -> 24 hour lock.
  - Audit trail for failed attempts is strictly append-only.

### 1.3 Token Lifecycles & Security Controls
- **JWT TTL & Signing Key Rotation**:
  - Access Token TTL: Exactly 15 minutes.
  - Refresh Token TTL: Exactly 30 days.
  - Refresh Token Rotation: Enabled on every refresh.
  - Token Family Reuse Detection: If a revoked or past refresh token is reused, the entire token family is immediately revoked (`TOKEN_FAMILY_REVOKED`).
  - Signing Key Rotation: Quarterly rotation schedule (every 3 months).
- **Authorization Errors**:
  - Whenever permission is denied, system returns `HTTP 403 Forbidden` with a stable error code (`AUTH_FORBIDDEN`) and writes an append-only audit event.

### 1.4 Auth Security Reporting Endpoints
- `GET /auth/reports/funnel`: Registration funnel conversion rates across client and attorney onboarding stages.
- `GET /auth/reports/otp-success`: OTP delivery and verification success rate analytics.
- `GET /auth/reports/security-events`: Administrator view for suspicious logins, brute-force lockouts, and token reuse anomalies.

---

## 2. User Management Module (`/api/v1/users`)

### 2.1 User Lifecycle, Bulk Operations & Archival
- **User CRUD & Search**: Filterable by registration date, last login date, role, and verification status.
- **Bulk Operations**: Bulk CSV/JSON import/export with batch validation.
- **Archival & Recovery**: `archive` sets `isArchived = true`, `status = ARCHIVED`. `restore` reverts user to `ACTIVE` and fires `USER_RESTORED`.
- **Duplicate Merging (`POST /users/merge`)**: Merges duplicate client records, transferring sessions and preferences.

### 2.2 Status State Machine
- `activate` -> `status = ACTIVE` (`USER_ACTIVATED`).
- `deactivate` -> `status = INACTIVE` (`USER_DEACTIVATED`).
- `suspend` -> `status = SUSPENDED` (`USER_SUSPENDED`).
- `lock`/`unlock` -> `banned = true/false` with `banReason`.

---

## 3. Attorney Profile, Education & Credential Vault Module (`/api/v1/attorneys`)

### 3.1 Profile Structure & Education
- **Profile Fields**: Public slug, bi-lingual bios (`bioEn`, `bioAm`), photo key, office address, geo-coordinates, video support toggle, buffer time, max daily bookings, languages (`en`, `am`), experience years, bar registration number, bar admission year (`barAdmissionYear`).
- **Education Record (`AttorneyEducation`)**: Exposes public education history (`institution`, `degree`, `fieldOfStudy`, `startYear`, `endYear`).
- **Public Credential Vault (`credentials_public`)**:
  - Exposes public projection: `id`, `attorney_id`, `type`, `issuer`, `verified_at`, `verified_badge`.
  - Invariant: Physical credential raw document files (`CredentialDocument`) are NEVER publicly exposed under any circumstances.

### 3.2 Open vs Guarded Fields & Guarded Changes History
- **Guarded Fields**: `barRegistrationNumber`, `practiceAreas`, `credentials`, `feeBand`.
- **Open Fields**: `bioEn`, `bioAm`, `officeAddress`, `languages`, `photoKey`.
- **Workflow**:
  - Editing open fields updates profile immediately.
  - Editing guarded fields creates a `GuardedChange` record and triggers a `VerificationCase`.
  - The old public value remains active on the public profile until verification succeeds.
- **GuardedChange Entity**: Stores `id`, `attorney_id`, `field`, `old_value`, `new_value`, `verification_case_id`, `status` (`PENDING`/`APPROVED`/`REJECTED`), `decision_by`, `timestamps`.

### 3.3 Three-Part Profile Publication Gate
A profile CANNOT be published (`publish`) unless all four conditions are met:
```text
CAN_PUBLISH_PROFILE =
    verificationStatus == APPROVED
    AND profileCompleteness >= 80%
    AND feeBand != null
    AND credentialClaimsMatch == true
```

### 3.4 Profile Validation Rules
- **Bio**: 100–1,500 characters per supported language (`en`, `am`).
- **Practice Areas**: 1–5 practice areas selected.
- **Fee Band**: Exactly one admin-defined band selected.

### 3.5 Profile Moderation & Completeness Nudge
- **Moderation Actions**: `WARN`, `SUSPEND`, `RESTORE`.
  - Requires explicit reason code and admin note. Writes audit log and notifies attorney.
  - `SUSPEND`: Immediately hides public attorney profile from discovery.
- **completeness Nudge Scheduler**: If profile completeness remains below 80% for 7 consecutive days, an automated reminder notification is dispatched to attorney.
- **Photo Processing Requirements**: JPEG/PNG only, <= 5 MB, resized into standard renditions, malware scanned, EXIF metadata stripped.

---

## 4. Attorney Verification & Fraud Review Module (`/api/v1/verifications`)

### 4.1 Standing Check & Mandatory Verification Checklist
- **Manual Bar-Association Standing Check**: Structured record keeping storing `standingStatus`, `standingCheckedAt`, `standingCheckedBy`, `standingNotes`.
- **Mandatory 4-Item Verification Checklist**:
  1. Identity Match (`identity_match`)
  2. Bar Number Format (`bar_number_format`)
  3. Certificate Authenticity (`certificate_authenticity`)
  4. Bar Standing (`bar_standing`)
  - A verification case CANNOT be approved until all 4 checklist items are marked `PASSED`.

### 4.2 3-Business-Day SLA & Pause/Resume Rules
- SLA Target: 3 business days for initial verification decision.
- Breaches trigger escalation alert to Verification Lead and SLA report logging.
- `MORE_INFO_REQUIRED` SLA Pause Rule:
  - Transitioning to `MORE_INFO_REQUIRED` PAUSES the SLA timer (`isSlaPaused = true`).
  - When the attorney uploads required info/documents, SLA timer RESUMES.

### 4.3 Fraud Detection Signals & Segregation of Duties
- **Three Fraud Signals**:
  1. Duplicate documents across multiple accounts
  2. Mismatched identity data
  3. Velocity anomalies (burst document uploads across multiple profiles)
- **Fraud Case Flagging**: Fraud signal detection transitions case to `fraudStatus = FRAUD_REVIEW`.
- **Segregation of Duties**: A reviewer who flags a case for fraud CANNOT issue the final decision on that case. Fraud cases require a second Senior Reviewer (`assignedSeniorReviewerId`).

### 4.4 Immutable Verification Decisions & Access Logging
- **Immutable Decisions**: Verification decisions are strictly immutable. Corrections MUST create a NEW `VerificationCase` referencing `previousCaseId`.
- **AES-256 Encryption & View Audit**: Credential files are stored with AES-256 encryption at rest. Every file view by a reviewer writes a `VerificationDocumentAccessLog` (`reviewerId`, `caseId`, `documentId`, `ipAddress`, `timestamp`).

### 4.5 Annual Re-Verification Scheduler
- 12 months post-approval, an annual re-verification case is automatically opened 30 days prior to license expiry, notifying the attorney.

### 4.6 Verification Queue & Workspaces
- Queue Operations: Filter by case type, case age, SLA state, reviewer assignment, and bulk claim.
- Fraud Review Workspace API: Exposes linked-case graph, shared documents, shared device footprints, and senior reviewer decision panel.
- Attorney Status View: Exposes current case status, upload interface for requested info, and decision history.

---

## 5. Public Attorney Discovery & Ranking Module (`/api/v1/discovery`)

### 5.1 5-Step Guided Questionnaire & URL Filter State
- **5 Questionnaire Dimensions (`POST /discovery/questionnaire`)**:
  1. Matter Type
  2. Urgency
  3. Location
  4. Language
  5. Budget Band
- **Shareable Filter URLs**: Search & filter state is fully URL-encoded and shareable.

### 5.2 Anonymous Preview Limitations
Anonymous (unauthenticated) users viewing discovery results experience:
1. Maximum 3 search results displayed.
2. Surnames masked (e.g. "Abebe B.").
3. Localized registration prompt banner presented.
4. Contact and booking actions strictly disabled.

### 5.3 4-Factor Weighted Ranking Algorithm & Invariants
- **Default Ranking Weights**:
  - `30%` Verification Level (`hasVerifiedBadge`, credential completeness)
  - `25%` Responsiveness Score (`responsivenessScore`)
  - `25%` Rating (`rating`, review quality)
  - `20%` Experience Years (`experienceYears`)
  - Weights MUST total exactly 100%.
- **No Paid Ranking Invariant**: Paid promotion, paid boosting, or manual reordering is strictly PROHIBITED.
- **Ranking Transparency**: Public endpoint `GET /discovery/ranking-explanation` serves localized explanation of ranking methodology.
- **Discovery Availability Gate**: Attorney must be `APPROVED` AND have at least one published availability window to appear in discovery.

---

## 6. Role-Based Access Control Module (`/api/v1/roles`, `/permissions`)

- System Roles (`SUPER_ADMIN`, `ADMIN`, `ATTORNEY`, `CLIENT`) and custom roles.
- `hierarchyLevel` enforcement preventing lower-level admins from modifying higher-level roles.
- Role cloning and dynamic permission matrix evaluation.

---

## 7. Administration Module (`/api/v1/admin`)

### 7.1 Admin Reasoned Actions
Any administrative account suspension or lock action MUST capture:
1. Reason code
2. Admin note
3. Immediate session revocation across all devices
4. Automated user notification dispatch
5. Immutable audit log record

### 7.2 Unified Business Work Queues
Distinct from technical job queues (BullMQ/RabbitMQ), the platform manages 4 unified business queues with strict SLAs:
- `Verification Queue`: 3 business days SLA
- `Support Queue`: 2 business days SLA
- `Moderation Queue`: 1 business day SLA
- `Disputes Queue`: 5 business days first response SLA
- Queue SLA breaches trigger escalation alerts to designated department leads.

### 7.3 Platform Health Metrics Wall (`GET /admin/platform-health`)
Exposes operational metrics: Notification delivery success rates, Verification SLA breach rates, and Payment success rates.

---

## 8. Configuration Management & Maker-Checker Governance (`/api/v1/settings`)

### 8.1 Dual-Approval (Maker-Checker) Workflow
Critical system configuration changes MUST follow a dual-approval workflow:
- **Governed Configurations**: Ranking weights, Commission rates, Fee bands, Cancellation policies.
- **Workflow**:
  1. Admin A submits proposed configuration change -> status set to `PENDING_APPROVAL`.
  2. Admin B (different admin) reviews and approves -> status set to `APPROVED`.
  3. Effective-dated version is activated in `SystemConfig`.

---

## 9. Localization Governance Module (`/api/v1/localization`)

### 9.1 Legal-Sensitive Translation Gate
Translation keys flagged as `legalSensitive = true` CANNOT be published directly. They enter `LEGAL_REVIEW` status and require explicit legal reviewer approval before publishing.

### 9.2 Data & Formatting Standards
- **Locales**: MVP supports `en` (English) and `am` (Amharic); architecture supports N locales.
- **Money Representation**: Stored strictly as integer santim (e.g. 100 ETB = 10000 santim).
- **Time Representation**: All timestamps stored in UTC; displayed in East Africa Time (EAT, UTC+3).
- **Ethiopian Calendar**: Used for display only; NEVER used for internal calculations, date arithmetic, or SLA tracking.

### 9.3 Translation Coverage Dashboard (`GET /localization/dashboard`)
Displays completion percentage per namespace, missing keys backlog, CDN catalog publishing status (5-minute edge propagation target), and missing key logging.

---

## 10. Public Website CMS & Anti-Abuse (`/api/v1/public`, `/cms`)

### 10.1 CMS Pages & Content
Serves localized public pages: Client How-It-Works, Attorney How-It-Works, Practice-Area landing pages, Verified Badge Explainer, Terms, Privacy Policy, and FAQ.

### 10.2 SEO & Web Security Controls
- Sitemap generation (`GET /public/sitemap.xml`), SEO metadata, Open Graph tags, Cookie/consent banner config.
- Security Headers: Content Security Policy (CSP), HSTS, TLS 1.2+ requirement, CAPTCHA on contact form.
- **Contact Form Anti-Abuse Rate Limit**: Submitting `POST /public/contact` is rate limited to max 3 submissions per 10 minutes per IP address. The 4th submission is strictly REJECTED with `HTTP 429`.

---

## 11–15. Additional Services
- **Queue Telemetry**: Technical job monitoring (BullMQ/RabbitMQ) and dead-letter queue remediation.
- **Audit Logging**: Structured delta tracking with CSV compliance streaming.
- **File Storage**: Multi-provider S3/Local abstraction with pre-signed download URLs.
- **Search**: Multi-criteria user and attorney search endpoints.
- **Outbox Event Publisher**: Transactional outbox dispatching events to RabbitMQ.

---

## Summary Matrix of 15 Modules

| Module Index | Module Name | REST Base Path | Key Tebeka v3.0 Invariants |
| :---: | :--- | :--- | :--- |
| **1** | Auth & Security | `/api/v1/auth` | `ONE_PHONE_PER_ROLE`, OTP continuation token, 5 req/hr OTP limit, progressive lockout |
| **2** | User Management | `/api/v1/users` | Persona lifecycle, bulk import/export, archive/restore, duplicate merge |
| **3** | Attorney Profile | `/api/v1/attorneys` | Education, `barAdmissionYear`, public credential vault, guarded changes, 3-part publication gate |
| **4** | Verification & Fraud | `/api/v1/verifications` | Standing check, 4 checklist items, 3-day SLA (pause/resume), fraud review, segregation of duties |
| **5** | Public Discovery | `/api/v1/discovery` | 5-step questionnaire, anonymous preview masking, 30/25/25/20 ranking, no paid boosting |
| **6** | RBAC | `/api/v1/roles` | Role hierarchy, permission matrix, resource ownership guards |
| **7** | Administration | `/api/v1/admin` | Admin reasoned actions, unified business queues (SLA), platform health wall |
| **8** | Configuration | `/api/v1/settings` | Dual-approval (Maker-Checker) workflow, snapshot versioning & rollback |
| **9** | Localization | `/api/v1/localization` | Legal translation gate, integer santim, UTC/EAT time, Ethiopian calendar display-only |
| **10** | Public Website | `/api/v1/public` | How-it-works, sitemap, contact rate limit (3/10m), CSP/HSTS headers |
| **11** | Queue Telemetry | `/api/v1/queues` | BullMQ/RabbitMQ job health, dead-letter queue remediation |
| **12** | Audit Logging | `/api/v1/audit-logs` | Append-only audit trail, delta tracking, CSV compliance export |
| **13** | File Management | `/api/v1/files` | AES-256 encrypted credential vault, EXIF stripping, pre-signed URLs |
| **14** | Search | `/api/v1/search` | Multi-criteria attorney and user search index |
| **15** | Outbox Publishing | Background | Transactional outbox event dispatching to RabbitMQ |
