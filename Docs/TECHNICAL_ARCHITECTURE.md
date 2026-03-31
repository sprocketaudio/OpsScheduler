# TECHNICAL_ARCHITECTURE.md

## 1. Purpose

This document defines the technical architecture for OpsScheduler.

The goal is to keep the system simple, secure, and maintainable while using proven technologies.

---

## 2. High-Level Architecture

OpsScheduler is a single application with the following components:

- Frontend and backend combined in a Next.js application
- PostgreSQL database
- Authentication via Auth.js
- Email delivery via Resend
- Reverse proxy via nginx
- Hosting on a single server environment

---

## 3. System Overview

### Application Layer

- Built using Next.js
- Handles:
  - UI rendering
  - API routes
  - authentication flows
  - server-side logic

### Database Layer

- PostgreSQL
- Accessed via Prisma ORM
- Prisma CLI configuration defined in `prisma.config.ts`
- Prisma Client uses PostgreSQL driver adapter (`@prisma/adapter-pg`)
- Stores:
  - users
  - accounts
  - verification tokens
  - auth sessions
  - work items
  - organisations
  - rate-limit buckets
  - audit events

### Authentication Layer

- Auth.js with database sessions
- Email-based magic link login
- Approved user allowlist enforced server-side via configuration
- No password storage

---

## 4. Frontend Stack

- Next.js (App Router)
- React
- TypeScript

### UI Components

- shadcn/ui for base components
- Tailwind CSS for styling
- MUI X Date Pickers for shared calendar picker controls
- MUI Material + Emotion runtime for picker rendering
- date-fns for picker date adapter and locale formatting

### Calendar and Interaction

- FullCalendar for calendar rendering
- dnd-kit for drag and drop

---

## 5. Backend Stack

- Next.js API routes or server actions
- Prisma ORM
- Zod for validation
- `POST /api/items` creation endpoint with strict validation, org-scoped writes, and rate limiting
- `GET /api/items/:id` detail endpoint for loading item data into the detail panel, including read-only audit metadata
- `PATCH /api/items/:id` atomic autosave endpoint for combined detail and schedule-range updates (title/customer/notes, assignee, fixed/on_hold/cancelled/done, start/end date/time, and target week)
- `DELETE /api/items/:id` endpoint for admin-only item deletion scoped to the authenticated user's organization
- `PATCH /api/items/:id/placement` placement endpoint for drag-and-drop scheduling updates outside detail-panel autosave flow
- `PATCH /api/users/me/preferences` endpoint for authenticated user settings preferences (date locale, theme mode, and calendar visible window)
- `PATCH /api/admin/colour-settings` endpoint for admin-only user/default colour management with reserved-colour blocking
- Dashboard server load applies organization-scoped carry-forward for unscheduled bucket items from prior weeks into the current week

---

## 6. Database

- PostgreSQL running in Docker
- Database not publicly exposed
- Access limited to application only

---

## 7. Authentication

- Auth.js with email magic links
- Sessions stored in database
- Secure cookies with HTTPS
- Unauthenticated users are redirected to `/login` for protected routes
- Sign-in allowed only for active users already provisioned in database
- Session access is revalidated against current user activity status
- Auth endpoint uses request rate limiting for abuse protection
- Optional development-only bypass can auto-authenticate an active admin or user via environment switch (disabled in production runtime and ignored during production build prerender)

---

## 8. Email

- Resend for sending magic link emails
- No self-hosted SMTP for MVP
- Email used only for authentication and optional future notifications

---

## 9. Hosting

### Application

- Runs directly on host (Node.js 24 LTS)
- Managed via process manager (e.g. PM2)

### Database

- PostgreSQL containerised via Docker
- Data persisted via Docker volume

### Reverse Proxy

- nginx handles:
  - HTTPS termination
  - routing to application
  - domain configuration

---

## 10. Environment Configuration

Required environment variables include:

- DATABASE_URL
- AUTH_SECRET
- AUTH_URL
- AUTH_EMAIL_FROM
- AUTH_ALLOWED_EMAILS
- AUTH_MAGIC_LINK_MAX_AGE_SECONDS
- AUTH_SESSION_MAX_AGE_SECONDS
- AUTH_SESSION_UPDATE_AGE_SECONDS
- AUTH_SIGNIN_RATE_LIMIT_REQUESTS
- AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS
- RESEND_API_KEY

Seed configuration variables:

- SEED_ORGANIZATION_NAME
- SEED_ADMIN_EMAIL

Optional development-only auth bypass variables:

- AUTH_DEV_BYPASS_MODE (`off`, `admin`, `user`)
- AUTH_DEV_BYPASS_ADMIN_EMAIL (optional explicit active admin email)
- AUTH_DEV_BYPASS_USER_EMAIL (optional explicit active user email)

Optional audit logging variables:

- AUDIT_LOG_RETENTION_DAYS (default `180`)
- AUDIT_LOG_MIRROR_CONSOLE (`true` or `false`)

Additional variables may be added as needed.

Prisma configuration notes:

- `DATABASE_URL` is configured in `prisma.config.ts`
- Prisma schema defines provider and model structure only

Tooling baseline for MVP:

- Runtime: Node.js 24 LTS
- Package manager: pnpm

Database bootstrap for MVP:

- Apply migrations via `pnpm prisma:migrate:deploy`
- Seed default organization and initial users via `pnpm prisma:seed`

---

## 11. Request Flow

1. User accesses application via HTTPS
2. nginx routes request to Next.js app
3. Authentication handled via Auth.js
4. Requests validated via Zod
5. Business logic executed in server layer
6. Prisma interacts with PostgreSQL
7. Response returned to client

---

## 12. Security Considerations

- All traffic must use HTTPS
- Database must not be publicly accessible
- Secrets must be stored in environment variables
- Input validation must be enforced at API boundary
- Authentication handled by trusted library
- Baseline security headers must be applied (CSP, frame protection, and referrer policy)
- Public auth and all mutating API endpoints must be rate-limited via shared database-backed fixed-window buckets
- Mutating browser requests must pass same-origin validation against configured `AUTH_URL` origin

---

## 13. Scaling Approach

For MVP:

- Single server deployment
- Single database instance
- Minimal infrastructure complexity

Future options:

- Separate application and database servers
- Horizontal scaling of application
- Managed database services
- CDN for static assets

---

## 14. Logging and Monitoring

- Application logs for:
  - errors
  - authentication events
  - key actions
  - structured audit events for sign-in and core work-item mutations (create, update, placement update, delete)
- Structured audit events are persisted to PostgreSQL (`AuditEvent`) as the durable sink
- Audit retention cleanup is enforced by `AUDIT_LOG_RETENTION_DAYS` during audit writes
- Access to durable audit records is restricted to controlled database access paths (no public API exposure)
- Monitoring kept minimal for MVP
- Single-org public-web operational safeguards (backup schedule, restore drill process, incident escalation path, and patch cadence) are defined in `Docs/OPERATIONS_RUNBOOK_SINGLE_ORG.md`

---

## 15. Deployment Strategy

- Manual deployment for MVP
- Build application on server
- Restart application process
- Database migrations applied via Prisma

Future:

- CI/CD pipeline
- automated deployments

---

## 16. Dependencies

Core dependencies:

- Next.js
- React
- TypeScript
- Prisma
- Auth.js
- @next-auth/prisma-adapter
- nodemailer (Auth.js email provider peer dependency)
- Zod
- FullCalendar
- dnd-kit
- shadcn/ui
- Tailwind CSS
- @mui/x-date-pickers
- @mui/material
- @emotion/react
- @emotion/styled
- date-fns

Development/testing tools:

- Vitest for automated hardening and regression test execution (`pnpm test`)

---

## 17. Constraints

- Keep architecture simple
- Avoid microservices
- Avoid unnecessary abstraction
- Use proven libraries over custom implementations
- Minimise operational overhead

---

## 18. Source of Truth

- Database is the source of truth
- Application logic must reflect defined workflow rules
- No hidden state outside defined model

---

## Dependency Versioning Strategy

- All libraries must use the latest stable versions at the time of initial implementation
- Versions should be explicitly defined (no unbounded latest or wildcard versions)
- Avoid using alpha, beta, or experimental releases
- Verify latest stable versions at implementation time and pin them in package.json and lockfile
- Dependencies should be reviewed and updated periodically, not automatically
- Breaking changes must be reviewed before upgrading major versions

---

## 19. Future Extensions

- Multi-organisation UI support
- External API expansion
- Spreadsheet integration updates
- Notification system
- Mobile optimisation
- framer-motion for subtle UI transitions and interaction polish (introduced in later phases only)
