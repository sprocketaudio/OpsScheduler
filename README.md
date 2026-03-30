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

AI implementation rules are defined separately:

- AGENTS.md (root)

---

## Getting Started

### Prerequisites

- Node.js 22 LTS
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

Note: Phase 3 data model and database seeding are implemented.

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

Seed variables:

- SEED_ORGANIZATION_NAME  
- SEED_ADMIN_EMAIL  

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
