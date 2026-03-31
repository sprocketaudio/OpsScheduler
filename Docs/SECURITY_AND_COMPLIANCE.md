# SECURITY_AND_COMPLIANCE.md

## 1. Purpose

This document defines the security and compliance approach for OpsScheduler.

The goal is to ensure the system is secure, low risk, and appropriate for internal operational use, without over-engineering.

---

## 2. Security Principles

- Keep the system simple and controlled
- Avoid storing sensitive or regulated data
- Use proven libraries for security-critical functionality
- Do not implement custom authentication logic
- Restrict access to approved users only
- Ensure all data access is scoped and controlled

---

## 3. Data Classification

### Allowed Data

The system is designed to store only basic operational data:

- Work item titles and descriptions
- Customer reference names (non-sensitive)
- Scheduling data (dates and times)
- Internal notes (non-sensitive)

### Prohibited Data

The system must not store:

- Personal sensitive data (e.g. health, financial, identity data)
- Credentials (passwords, tokens, API keys)
- Regulated or confidential customer data
- Any data classified as restricted by the organisation

---

## 4. Authentication

- Authentication is handled via email-based one-time sign-in code login
- No password storage is allowed
- Authentication must be implemented using a proven library (Auth.js)
- One-time sign-in codes must be short-lived and secure (default 15 minutes)
- Sessions must be securely stored and managed
- Login request responses must use a neutral confirmation message to reduce user-enumeration risk
- For local development only, a guarded auth bypass may be enabled via environment configuration to impersonate an active provisioned user by role
- Dev bypass must remain disabled in production and must not replace Auth.js authentication in deployed environments

---

## 5. Session Management

- Sessions must be stored in the database
- Sessions should support rolling expiry with explicit limits (default 14 days max age, 12 hours update age)
- Session usage must be revalidated against the current user active state
- Session cookies must be:
  - HTTP-only
  - Secure (HTTPS only)
  - SameSite protected

---

## 6. Access Control

- Access is restricted to approved users only
- No public registration
- Users must be pre-approved or invited

For MVP Phase 2 and Phase 3:
- Approved users are controlled by a server-side email allowlist (`AUTH_ALLOWED_EMAILS`)
- Login is allowed only for active, provisioned users stored in the database

### Roles

- Admin:
  - Manage users
  - Assign colours
  - Delete work items

- User:
  - Create and manage work items
  - Assign and schedule items

---

## 7. Organisation Isolation

- All data must be scoped by organization_id
- Users must only access data within their organisation
- No cross-organisation access is permitted

For MVP:

- Single organisation only
- Isolation logic must still be enforced in queries

---

## 8. API Security

- All API endpoints must require authentication
- All requests must be validated using a schema validator (Zod)
- No unvalidated input should be processed
- Only required fields should be accepted
- Reject unexpected or extra fields
- Rate limiting must be applied to public authentication and all mutating API endpoints
- Authentication rate limiting must cover both code issuance (`/api/auth/signin/email`) and code verification (`/api/auth/callback/email`)
- Mutating endpoint limits must return `429` responses with `Retry-After` headers
- Rate limiting must use shared backend storage so limits remain consistent across processes/instances
- Mutating browser requests must pass same-origin validation against `AUTH_URL` using `Origin` and `Referer` fallback checks
- Auth rate-limit controls must be configurable via environment variables

---

## 9. Input Validation

- All inputs must be validated at the API boundary
- Validation must include:
  - type checking
  - required fields
  - length constraints
- Sanitisation should be applied where necessary

---

## 10. Data Protection

- Application must run over HTTPS only
- Database must not be publicly accessible
- Secrets must be stored in environment variables
- No secrets must be committed to source control
- Baseline security headers must be configured (including CSP, frame protections, and referrer policy)

---

## 11. Logging

- Log key system events:
  - user login
  - item creation
  - item updates
  - item placement updates
  - deletions
- Audit logging for auth and core business actions is mandatory for MVP hardening and is implemented as structured server audit events
- Structured audit events must be persisted to a durable sink (PostgreSQL `AuditEvent` in MVP hardening)
- Retention must be enforced via configuration (`AUDIT_LOG_RETENTION_DAYS`)
- Access to durable audit records must be restricted to controlled infrastructure/database roles
- Audit metadata must avoid unnecessary personal data (for example, hashed identifiers instead of raw email values where actor identity is unavailable)

- Logs must not contain sensitive data
- Logging should support debugging but remain minimal

---

## 12. Backups

- Database backups must be taken regularly
- Backup process must be documented
- Restore process should be tested periodically
- Single-org web deployment backup/restore procedures and cadence are defined in `Docs/OPERATIONS_RUNBOOK_SINGLE_ORG.md`
- Non-production restore drills must be recorded as operational evidence before public go-live

---

## 13. Dependencies

- Only well maintained and widely adopted libraries should be used
- Avoid unnecessary dependencies
- Keep dependencies up to date
- Dependencies must be kept up to date with stable releases
- Known vulnerabilities must be patched promptly

Critical libraries include:

- Auth.js for authentication
- Prisma for database access
- Zod for validation

---

## 14. Hosting Security

- Application hosted on controlled infrastructure
- Reverse proxy (nginx) handles HTTPS
- Only required ports exposed
- Database runs in isolated environment (e.g. Docker)
- Firewall rules restrict access

---

## 15. Compliance Position

- System is designed for low-risk internal operational use
- No sensitive or regulated data is stored
- Not intended for external or customer-facing use in MVP
- Designed to minimise compliance burden

---

## 16. Future Considerations

The following may be required if the system evolves:

- SSO integration (Microsoft Entra ID)
- Multi-organisation isolation enforcement at scale
- Audit trail enhancements
- Data retention policies
- Formal security review

---

## 17. Non-Negotiable Rules

- No sensitive data must be stored
- No custom authentication logic must be implemented
- All inputs must be validated
- All data access must be scoped by organization_id
- HTTPS must always be used
- Secrets must never be exposed
- Development-only auth bypass controls must be disabled in production
