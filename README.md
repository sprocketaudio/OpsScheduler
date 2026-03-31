# OpsScheduler

OpsScheduler is a lightweight internal scheduling tool designed to improve how Operations teams manage and schedule work.

It replaces the current Outlook-based workflow with a faster, more visual, and lower friction interface, while keeping the process familiar.

---

## Overview

OpsScheduler provides:

- Weekly calendar view with drag and drop scheduling
- Bucket for unscheduled work
- Simple work item creation via UI or API
- Visual ownership using user colours
- Fixed and Done states without hiding items
- Automatic carry forward of unscheduled work

The system is designed to be simple, secure, and maintainable.

---

## Documentation

All core documentation is located in the `/Docs` folder.

Key documents:

- Docs/PRODUCT_REQUIREMENTS.md  
- Docs/WORKFLOW_RULES.md  
- Docs/UI_UX_SPEC.md  
- Docs/DATA_MODEL.md  
- Docs/SECURITY_AND_COMPLIANCE.md  
- Docs/TECHNICAL_ARCHITECTURE.md  
- Docs/MVP_ROADMAP.md  
- Docs/TEST_PLAN.md  
- Docs/WEB_HARDENING_SINGLE_ORG.md  
- Docs/OPERATIONS_RUNBOOK_SINGLE_ORG.md  

AI implementation rules are defined separately:

- AGENTS.md (root)

---

## Getting Started

### Prerequisites

- Node.js 24 LTS
- PostgreSQL
- pnpm

### Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy `.env.example` to `.env` and configure values, for example:

```bash
copy .env.example .env
```

3. Apply and validate Prisma setup:

```bash
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm prisma:format
pnpm prisma:validate
```

4. Start the application:

```bash
pnpm dev
```

5. Run automated checks:

```bash
pnpm test
pnpm verify:hardening
```

Note: MVP work through Phase 13 (Polish and Stability) is implemented locally. Phase 14 (deployment hardening and rollout) remains pending.

---

## Environment Variables

Required variables:

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

Optional audit logging variables:

- AUDIT_LOG_RETENTION_DAYS (default `180`)  
- AUDIT_LOG_MIRROR_CONSOLE (`true`/`false`, defaults to `true` outside production)  

Seed variables:

- SEED_ORGANIZATION_NAME  
- SEED_ADMIN_EMAIL  

Optional development-only auth bypass variables:

- AUTH_DEV_BYPASS_MODE (`off`, `admin`, `user`)  
- AUTH_DEV_BYPASS_ADMIN_EMAIL (optional explicit active admin email)  
- AUTH_DEV_BYPASS_USER_EMAIL (optional explicit active user email)  

Notes:

- Keep `AUTH_DEV_BYPASS_MODE=off` for normal magic-link authentication.
- If bypass mode is enabled, the app auto-authenticates an active database user by role.
- Bypass mode is blocked in production runtime and ignored during production build prerender.

---

## Development Approach

- Follow MVP_ROADMAP.md for implementation order  
- Follow WORKFLOW_RULES.md as the source of truth for behaviour  
- Follow AGENTS.md for implementation standards  

---

## Scope

OpsScheduler is:

- An internal tool for team coordination  
- Designed to store non-sensitive operational data only  
- Built for simplicity and maintainability  

Out of scope for MVP:

- Multi-organisation UI  
- Spreadsheet sync updates  
- Advanced reporting  
- External productisation  

---

## Guiding Principles

- Keep it simple  
- Keep it secure  
- Keep it predictable  
- Build only what is needed  
