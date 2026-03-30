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

1. Install dependencies with pnpm  
2. Configure environment variables  
3. Run database migrations  
4. Start the application  

---

## Environment Variables

Required variables:

- DATABASE_URL  
- AUTH_SECRET  
- AUTH_URL  
- RESEND_API_KEY  

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
