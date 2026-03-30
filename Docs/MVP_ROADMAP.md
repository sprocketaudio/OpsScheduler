# MVP_ROADMAP.md

## 1. Purpose

This document defines the step-by-step implementation plan for OpsScheduler MVP.

The goal is to ensure development happens in the correct order, avoids rework, and delivers a working system as early as possible.

Each phase should be completed, tested, and stable before moving to the next.

---

## 2. Principles

- Build in small, testable increments
- Do not skip phases
- Do not build future features early
- Keep the system working at the end of each phase
- Prioritise core workflow over polish
- Avoid premature optimisation

---

## 3. Phase 1: Project Setup

### Status
- Completed on March 30, 2026

### Objectives
- Initialise project structure
- Install core dependencies
- Configure environment

### Tasks
- Create Next.js project with TypeScript using Node.js 22 LTS and pnpm
- Install:
  - Prisma
  - PostgreSQL client
  - Auth.js
  - Zod
  - Tailwind CSS
  - shadcn/ui
- Set up basic folder structure
- Configure environment variables
- Set up Prisma schema

### Done Criteria
- Project runs locally
- No errors on startup
- Basic page renders

---

## 4. Phase 2: Authentication

### Status
- Completed on March 30, 2026

### Objectives
- Implement login system

### Tasks
- Configure Auth.js
- Implement magic link login via email
- Set up session handling
- Create login page
- Create basic protected route

### Done Criteria
- User can log in via email
- Session persists correctly
- Unauthenticated users cannot access app

---

## 5. Phase 3: Data Model and Database

### Objectives
- Implement core data model

### Tasks
- Extend Prisma schema for workflow entities:
  - Organization
  - WorkItem
  - Remaining User fields required by DATA_MODEL.md (role, colour, timezone, organisation linkage)
- Run initial migrations
- Seed:
  - default organisation
  - initial admin user
- Verify DB connectivity

### Done Criteria
- Database is running
- Data can be created and queried
- Schema matches DATA_MODEL.md

---

## 6. Phase 4: Basic UI Shell

### Objectives
- Create base layout

### Tasks
- Build top navigation bar
- Add week navigation controls
- Add placeholder calendar area
- Add placeholder bucket area
- Add basic layout styling

### Done Criteria
- Layout renders correctly
- Navigation elements visible
- No functional logic yet

---

## 7. Phase 5: Calendar and Bucket (Read-Only)

### Objectives
- Display data in UI

### Tasks
- Integrate FullCalendar
- Render week view
- Display bucket area
- Fetch and display work items from DB
- Separate bucket vs scheduled items visually

### Done Criteria
- Items appear in correct locations
- Calendar renders correctly
- Bucket shows unscheduled items

---

## 8. Phase 6: Create Item

### Objectives
- Enable item creation

### Tasks
- Implement POST /api/items
- Add Zod validation
- Implement quick add UI
- Create item in the clicked location (bucket, day, or time slot)
- Refresh UI after creation

### Done Criteria
- Items can be created from UI
- Items appear in the correct location after creation
- API works correctly

---

## 9. Phase 7: Drag and Drop

### Objectives
- Enable scheduling interaction

### Tasks
- Implement drag from bucket to calendar
- Implement drag from calendar to bucket
- Implement drag within calendar
- Update DB on movement
- Handle date and time assignment

### Done Criteria
- Items can be moved freely
- State updates correctly
- No data inconsistencies

---

## 10. Phase 8: Detail Panel

### Objectives
- Enable item editing

### Tasks
- Build item detail panel
- Implement edit fields:
  - title
  - customer
  - notes
- Save changes to DB
- Ensure panel interaction works cleanly

### Done Criteria
- Item can be edited
- Changes persist
- UI updates correctly

---

## 11. Phase 9: Assignment, Fixed, Done

### Objectives
- Complete core workflow features

### Tasks
- Assign user to item
- Apply colour based on user
- Toggle Fixed state
- Toggle Done state
- Ensure correct visual indicators

### Done Criteria
- Assignment works correctly
- Fixed and Done behave per WORKFLOW_RULES.md
- Visuals match UI_UX_SPEC.md

---

## 12. Phase 10: Search and Filters

### Objectives
- Improve usability

### Tasks
- Implement search functionality
- Implement My Items filter
- Implement Fixed filter
- Ensure fast response

### Done Criteria
- Search works in real time
- Filters update view correctly

---

## 13. Phase 11: Carry Forward Logic

### Objectives
- Automate bucket behaviour

### Tasks
- Implement automatic carry forward for bucket items
- Ensure scheduled items do not move
- Trigger logic on week change

### Done Criteria
- Bucket items move correctly to next week
- No unintended movement

---

## 14. Phase 12: Permissions and Admin

### Objectives
- Finalise access control

### Tasks
- Restrict delete to admin only
- Implement user role checks
- Ensure users cannot access unauthorised data

### Done Criteria
- Permissions enforced correctly
- No unauthorised actions possible

---

## 15. Phase 13: Polish and Stability

### Objectives
- Prepare for real use

### Tasks
- Fix UI inconsistencies
- Improve performance
- Add basic logging
- Test all workflows
- Clean up code

### Done Criteria
- System is stable
- No major bugs
- UI is clean and usable

---

## 16. Phase 14: Deployment

### Objectives
- Deploy system to server

### Tasks
- Configure nginx
- Set up HTTPS
- Deploy Next.js app
- Deploy PostgreSQL (Docker)
- Configure environment variables
- Run migrations

### Done Criteria
- App accessible via domain
- HTTPS working
- System usable by team

---

## 17. Out of Scope for MVP

Do not implement during MVP:

- Spreadsheet update sync
- Additional API endpoints beyond create
- Multi-organisation UI
- SSO integration
- Notifications
- Recurring work
- Reporting or analytics

---

## 18. Completion Criteria

MVP is complete when:

- Users can log in
- Work items can be created
- Items can be scheduled via drag and drop
- Items can be edited, assigned, marked Fixed and Done
- Bucket carry forward works
- System is stable and usable for real work

---

## 19. Guiding Rule

Always complete the current phase fully before moving to the next.

Do not skip ahead.
