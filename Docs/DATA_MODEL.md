# DATA_MODEL.md

## 1. Purpose

This document defines the data model for OpsScheduler.

The goal is to keep the model simple, predictable, and aligned with the workflow rules, while being future-ready for multi-organisation support.

---

## 2. Design Principles

- Keep the model minimal and focused
- Avoid unnecessary complexity
- Ensure all workflow state can be clearly derived from stored fields
- Design for multi-organisation support without exposing it in MVP
- Store only non-sensitive operational data

---

## 2.1 Phase Implementation Notes

- Phase 2 implements the authentication tables required by Auth.js:
  - User
  - Account
  - Session
  - VerificationToken
- In Phase 2, User contains Auth.js profile fields plus `active`
- Phase 3 extends User and adds Organization and WorkItem to complete the MVP workflow model
- Phase 3 introduces database seeding for:
  - default organization
  - initial admin user

---

## 3. Core Entities

### Organization

Represents a logical group or team.

Fields:

- id (string, primary key)
- name (string, required)
- default_colour (string, required, default `#2563eb`)
- created_at (timestamp)
- updated_at (timestamp)

---

### User

Represents a system user.

Fields:

- id (string, primary key)
- email (string, unique, required)
- name (string, required)
- colour (string, required, unique)
- role (enum: admin, user)
- profile_image_url (string, optional)
- date_locale (string, required, default `en-GB`)
- ui_theme (string, required, default `light`)
- timezone (string, optional)
- calendar_visible_start_time (string, required, default `08:00:00`)
- calendar_visible_end_time (string, required, default `20:00:00`)
- active (boolean, default true)

- organization_id (string, foreign key → Organization.id)

- created_at (timestamp)
- updated_at (timestamp)

Rules:

- Email must be unique
- Colour must be unique across all users
- User and organization default colours must not use reserved status outline colours
- date_locale must be one of the supported UI locales
- ui_theme must be one of the supported UI theme values (`light`, `dark`)
- Each user belongs to exactly one organization
- Only active users can access the system

---

### WorkItem

Represents a unit of work.

Fields:

- id (string, primary key)
- title (string, required)
- customer (string, optional)
- notes (string, optional)

- assignee_id (string, nullable, foreign key → User.id)

- organization_id (string, foreign key → Organization.id)

- target_week (date, required)

- start_date (date, nullable)
- end_date (date, nullable)

- start_time (time, nullable)
- end_time (time, nullable)

- fixed (boolean, default false)
- on_hold (boolean, default false)
- cancelled (boolean, default false)
- done (boolean, default false)

- created_by (string, foreign key → User.id)
- updated_by (string, foreign key → User.id)

- created_at (timestamp)
- updated_at (timestamp)

---

## 4. Relationships

- User.organization_id → Organization.id
- WorkItem.organization_id → Organization.id

- WorkItem.assignee_id → User.id
- WorkItem.created_by → User.id
- WorkItem.updated_by → User.id

---

## 5. State Derivation

Work item state is derived from its fields.

### Bucket State
- start_date is null
- item belongs to target_week
- item appears in the bucket

### Scheduled State
- start_date is not null
- item appears in the calendar

### All-Day Item
- start_date is set
- start_time is null

### Timed Item
- start_date and start_time are set

### Multi-Day Item
- start_date and end_date are set
- time fields are null

---

## 6. Field Rules

### target_week

- Always required
- Represents the week the item belongs to when unscheduled
- Automatically set on creation
- Used to group bucket items

---

### Dates and Times

- start_date is required for scheduled items
- end_date is optional for multi-day items
- start_time and end_time are optional
- time fields must not exist without start_date

---

### fixed

- Default false
- Indicates pre-arranged timing
- Affects visual display only

---

### on_hold

- Default false
- Indicates work is paused
- Affects visual display only

---

### cancelled

- Default false
- Indicates work is cancelled
- Affects visual display only

---

### done

- Default false
- Indicates completion
- Does not remove or hide item

---

## 7. Organisation Rules

- All users must belong to an organization
- All work items must belong to an organization
- All queries must be scoped by organization_id

For MVP:

- Only one organization exists
- Organization is created and seeded at setup
- Organization is not user-configurable
- No organization switching is supported

---

## 8. Constraints

- User.email must be unique
- User.colour must be unique
- WorkItem.title must not be empty
- WorkItem.target_week must be valid
- start_time cannot exist without start_date
- end_time cannot exist without start_time
- calendar_visible_start_time and calendar_visible_end_time must be valid 24-hour times
- calendar_visible_end_time must be later than calendar_visible_start_time
- date_locale must be a supported locale code (MVP: `en-GB` or `en-US`)

---

## 9. Indexing

Recommended indexes:

- WorkItem.organization_id
- WorkItem.target_week
- WorkItem.start_date
- WorkItem.assignee_id
- WorkItem.done
- WorkItem.cancelled
- WorkItem.on_hold
- WorkItem.fixed

---

## 10. Deletion Strategy

### MVP

- Hard delete only
- Admins can delete items
- No archive is maintained

### Future

- Optional soft delete using deleted_at field
- Optional audit history

---

## 11. Future Extensions

The following are not part of MVP but should be supported by the model:

- external_id for spreadsheet or API sync
- recurrence support
- organisation-level settings
- audit history tables
- tagging or categorisation

---

## 12. Source of Truth

- The database is the source of truth
- All UI and API behaviour must reflect stored data
- No hidden or derived state outside defined rules

---

## 13. Migration Strategy

- All schema changes must use Prisma migrations
- No manual database changes
- Schema must remain backwards compatible where possible
