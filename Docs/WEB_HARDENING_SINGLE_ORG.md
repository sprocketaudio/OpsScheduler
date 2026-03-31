# WEB_HARDENING_SINGLE_ORG.md

## 1. Purpose

This document defines the required hardening work for deploying OpsScheduler on the public internet while keeping a closed, small, single-organization user base.

This is a security and operational checklist, not a feature roadmap.

---

## 2. Scope

### In Scope

- Public web exposure of a single OpsScheduler instance
- One organization only
- Small approved user list (for example 5 to 25 users)
- Production hardening for application, API, authentication, and infrastructure

### Out of Scope

- Multi-tenant architecture
- SSO rollout
- New product features

---

## 3. Deployment Model Assumptions

- Next.js app runs behind nginx
- HTTPS is mandatory
- PostgreSQL is private (not internet reachable)
- Auth is magic link only (Auth.js + Resend)
- Users are provisioned in database and allowlisted

If any assumption changes, this document must be updated before deployment.

---

## 4. Hardening Requirements (Mandatory)

Each requirement below must be completed and evidenced before go-live.

### R1. Strict Production Auth Posture

- `AUTH_DEV_BYPASS_MODE` must be `off` in production environment
- Production runtime must never grant dev bypass sessions
- Production build must succeed without activating bypass logic
- Only active, provisioned, allowlisted users can sign in

Current progress:
- Pre-production validation completed (March 31, 2026):
  - `NODE_ENV=production` with `AUTH_DEV_BYPASS_MODE=off`: `pnpm build` passes
  - `NODE_ENV=production` with `AUTH_DEV_BYPASS_MODE=off`: `GET /dashboard` returns `307` redirect to `/login`
  - `NODE_ENV=production` with `AUTH_DEV_BYPASS_MODE=admin`: runtime `GET /dashboard` returns `500` (bypass rejected in production runtime)
  - `pnpm test -- src/server/auth/sign-in-policy.test.ts` passes (`5`/`5`) for allowlist/provisioned/active sign-in policy
- Pending for completion: verify deployed production environment configuration has `AUTH_DEV_BYPASS_MODE=off`

Implementation references:
- `src/server/auth/dev-bypass.ts`
- `src/server/auth/options.ts`
- `src/server/auth/session.ts`

### R2. CSP and Browser Security Header Hardening

- Keep baseline security headers enabled
- Remove `unsafe-eval` from CSP in production
- Reduce or eliminate `unsafe-inline` for scripts where possible (nonce/hash strategy)
- Keep `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
- Keep HSTS in production

Current progress:
- Completed (March 31, 2026): `unsafe-eval` removed from production `script-src`
- Pending: reduce/remove `unsafe-inline` for scripts using nonce/hash strategy

Implementation reference:
- `next.config.ts`

### R3. Trusted Client Identity and Proxy Boundary

- App must trust forwarding headers only from controlled reverse proxy
- Reverse proxy must overwrite incoming `X-Forwarded-For` and `X-Real-IP` from clients
- App must not rely on spoofable headers from untrusted hops
- Only required ports exposed publicly (443; optional 80 redirect)

Implementation references:
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/items/route.ts`
- `src/app/api/items/[id]/placement/route.ts`

### R4. Distributed Rate Limiting for Public Traffic

- Replace in-memory limiter with shared store (Redis or DB-backed strategy)
- Rate-limit all mutating routes, not only auth/create:
  - `/api/auth/signin/email`
  - `POST /api/items`
  - `PATCH /api/items/:id`
  - `PATCH /api/items/:id/placement`
  - `DELETE /api/items/:id`
  - `PATCH /api/users/me/preferences`
  - `PATCH /api/admin/colour-settings`
- Return `429` with `Retry-After`

Current progress:
- Completed (March 31, 2026): fixed-window limiter now uses PostgreSQL-backed `RateLimitBucket` storage and all listed mutating routes enforce shared `429` + `Retry-After` throttling

Implementation references:
- `src/server/security/rate-limit.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/items/route.ts`
- `src/app/api/items/[id]/route.ts`
- `src/app/api/items/[id]/placement/route.ts`
- `src/app/api/users/me/preferences/route.ts`
- `src/app/api/admin/colour-settings/route.ts`

### R5. CSRF and Origin Validation on Mutating API Routes

- Enforce same-origin checks for state-changing requests
- Validate `Origin` (and/or `Referer` fallback) against `AUTH_URL` host
- Reject missing/invalid origin for browser-originated mutating calls
- Keep Auth.js CSRF protections for auth routes

Implementation target:
- shared guard utility in `src/server/security/`
- apply to all mutating route handlers listed in R4

Current progress:
- Completed (March 31, 2026): shared origin guard (`src/server/security/origin.ts`) now validates browser mutating requests against `AUTH_URL` origin using `Origin`/`Referer` with invalid/missing browser-origin requests rejected

### R6. Dependency Vulnerability Baseline

- Resolve known production vulnerabilities before go-live
- Current required fix: upgrade/replace vulnerable `nodemailer` dependency
- Establish recurring dependency audit cadence

Current progress:
- Completed (March 31, 2026): upgraded `nodemailer` to `8.0.4` and verified `pnpm audit --prod` reports no known production vulnerabilities

Verification commands:
- `pnpm audit --prod`
- `pnpm outdated`

Implementation reference:
- `package.json`
- `pnpm-lock.yaml`

### R7. Durable Audit Logging

- Current console-only audit events are insufficient for enterprise traceability
- Ship structured audit events to durable log sink (SIEM/log platform)
- Define retention period and access controls
- Minimize sensitive metadata; avoid unnecessary personal data in logs

Current progress:
- Completed (March 31, 2026): structured audit events are persisted to PostgreSQL (`AuditEvent`) via `src/server/audit/log.ts`, retention cleanup is enforced by `AUDIT_LOG_RETENTION_DAYS`, and auth denial metadata uses hashed email identifiers instead of raw email addresses

Implementation references:
- `src/server/audit/log.ts`
- `src/server/auth/options.ts`
- `src/app/api/items/*.ts`
- `prisma/schema.prisma`

### R8. Atomic Item Autosave Writes

- Prevent partial-save state from split placement/details updates
- Placement and detail updates should be committed atomically server-side
- Use a single mutation endpoint or server-side transaction orchestration

Current progress:
- Completed (March 31, 2026): detail panel autosave now uses a single `PATCH /api/items/:id` mutation that validates and writes detail + schedule fields together, removing the previous split placement/details autosave path

Implementation references:
- `src/features/scheduler/item-detail-panel.tsx`
- `src/app/api/items/[id]/route.ts`
- `src/app/api/items/[id]/placement/route.ts`

### R9. Automated Test Gate Before Deploy

- Add automated tests for critical flows:
  - auth allowlist and inactive-user denial
  - org-scoped access controls
  - admin-only delete and admin-only color settings
  - create/update/placement mutation validation
  - carry-forward behavior
- Deployment pipeline must fail on test failure

Minimum required checks:
- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- automated test command (to be added to `package.json`)

Current progress:
- Completed (March 31, 2026): added Vitest automated coverage for auth policy decisions, org-scoped item access, admin-only delete/colour settings, create/update/placement validation, and carry-forward behavior; added `pnpm test` and `pnpm verify:hardening` gate command

### R10. Operational Safeguards

- Document backup and restore process
- Verify restore in non-production environment
- Define incident response owner and contact path
- Define patching cadence for dependencies and base OS/container images

Current progress:
- Completed (March 31, 2026): operational safeguards are documented in `Docs/OPERATIONS_RUNBOOK_SINGLE_ORG.md`, including backup schedule, restore procedure, non-production restore drill evidence, incident ownership/escalation path, and patching cadence

Implementation references:
- `Docs/OPERATIONS_RUNBOOK_SINGLE_ORG.md`

---

## 5. Recommended (Strongly) Before Public Go-Live

These are not strictly blocking for a very small closed user base, but strongly advised:

- Add request correlation IDs for API and audit events
- Add health/readiness endpoint and uptime monitoring
- Add brute-force and abuse alert thresholds (429 spikes, auth denials, 5xx rates)
- Introduce query/result guards for large search responses
- Move carry-forward execution to background trigger if data volume grows

---

## 6. Verification Checklist (Go/No-Go)

All items must be checked.

### Security Controls

- [ ] Dev bypass disabled in production runtime
- [x] CSP hardened for production (`unsafe-eval` removed)
- [ ] Reverse proxy forwarding headers trusted and controlled
- [x] Distributed rate limiting enabled for all mutating routes
- [x] Origin/CSRF checks applied to mutating API endpoints
- [x] No known exploitable production dependency vulnerabilities

### Integrity and Auditability

- [x] Audit logs shipped to durable store
- [x] Audit logs include actor/action/outcome/target consistently
- [x] Item autosave path cannot leave partial state

### Quality Gate

- [x] `pnpm lint` passes
- [x] `pnpm exec tsc --noEmit` passes
- [x] `pnpm build` passes
- [x] Automated test suite passes
- [x] Prisma schema validates and migrations are current

### Operations

- [ ] TLS certificate active and auto-renewal configured
- [x] Backup schedule documented with owner and cadence
- [x] Restore test completed and documented
- [ ] Error and abuse monitoring active

---

## 7. Evidence Record Template

Use this section to capture completion evidence.

| Requirement | Owner | Date | Evidence | Status |
| --- | --- | --- | --- | --- |
| R1 | Codex | 2026-03-31 | Pre-production validation: production build succeeds with bypass off; production runtime blocks bypass-enabled mode (`/dashboard` returns `500`); sign-in policy tests pass for allowlist/provisioned/active controls | In progress (final live env config verification pending) |
| R2 | Codex | 2026-03-31 | `next.config.ts` now sets production `script-src` without `unsafe-eval`; `pnpm build` passes | In progress (step 1 complete) |
| R3 |  |  |  |  |
| R4 | Codex | 2026-03-31 | Added DB-backed shared limiter (`RateLimitBucket`) and applied to all listed mutating routes with `429` + `Retry-After` responses | Complete |
| R5 | Codex | 2026-03-31 | Added shared same-origin mutation guard (`src/server/security/origin.ts`) and wired it to all listed mutating routes; browser-origin requests with invalid/missing origin are rejected | Complete |
| R6 | Codex | 2026-03-31 | Upgraded `nodemailer` to `8.0.4`; `pnpm audit --prod` now returns no known vulnerabilities | Complete |
| R7 | Codex | 2026-03-31 | Added durable `AuditEvent` sink with retention cleanup (`AUDIT_LOG_RETENTION_DAYS`), converted audit callsites to awaited writes, and reduced auth-denial metadata to hashed email identifiers | Complete |
| R8 | Codex | 2026-03-31 | Replaced split detail-panel autosave calls with single `PATCH /api/items/:id` request and server-side combined schedule+detail validation/update | Complete |
| R9 | Codex | 2026-03-31 | Added Vitest suite (`pnpm test`) covering auth policy, org scope, admin-only routes, mutation validation, and carry-forward; added `pnpm verify:hardening` gate command and validated all required checks | Complete |
| R10 | Codex | 2026-03-31 | Added single-org operations runbook with backup schedule, restore procedure, restore drill execution record (source/drill row counts matched), incident ownership/escalation path, and dependency/base image patch cadence | Complete |

---

## 8. Release Decision Rule

Public web deployment for the closed single-org user base is approved only when all mandatory requirements (R1-R10) are complete and evidenced.

If any mandatory item is incomplete, deployment is not approved.
