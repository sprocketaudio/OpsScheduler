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
- Stores:
  - users
  - work items
  - sessions
  - organisations

### Authentication Layer

- Auth.js with database sessions
- Email-based magic link login
- No password storage

---

## 4. Frontend Stack

- Next.js (App Router)
- React
- TypeScript

### UI Components

- shadcn/ui for base components
- Tailwind CSS for styling

### Calendar and Interaction

- FullCalendar for calendar rendering
- dnd-kit for drag and drop

---

## 5. Backend Stack

- Next.js API routes or server actions
- Prisma ORM
- Zod for validation

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

---

## 8. Email

- Resend for sending magic link emails
- No self-hosted SMTP for MVP
- Email used only for authentication and optional future notifications

---

## 9. Hosting

### Application

- Runs directly on host (Node.js 22 LTS)
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
- RESEND_API_KEY

Additional variables may be added as needed.

Tooling baseline for MVP:

- Runtime: Node.js 22 LTS
- Package manager: pnpm

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

- Logs stored locally or via simple logging system
- Monitoring kept minimal for MVP

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
- Zod
- FullCalendar
- dnd-kit
- shadcn/ui
- Tailwind CSS

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

## 19. Future Extensions

- Multi-organisation UI support
- External API expansion
- Spreadsheet integration updates
- Notification system
- Mobile optimisation
