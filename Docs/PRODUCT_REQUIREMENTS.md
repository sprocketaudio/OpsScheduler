# PRODUCT_REQUIREMENTS.md

## 1. Product Name

OpsScheduler

## 2. Overview

OpsScheduler is a lightweight internal scheduling tool for the Operations team.

Its purpose is to improve the current Outlook-based workflow used to manage and schedule work while keeping the overall process familiar, simple, and quick to use.

The system is intended to be visual, low friction, and easy to maintain. It should support the existing way the team works rather than forcing a new process.

## 3. Problem Statement

The current scheduling process relies on Outlook calendars. This works, but it has several limitations:

- Moving work between weeks is manual and inefficient
- Assigning and reassigning ownership is clunky
- The weekly view can become visually crowded
- Unscheduled work can be left behind unless manually moved
- The workflow is functional, but not purpose-built for operational scheduling

OpsScheduler is intended to solve these issues while preserving the strengths of the current approach.

## 4. Primary Goal

Provide a simple shared scheduling tool that allows the team to:

- Add work items into a weekly bucket
- Drag work items into days or time slots
- Use colour to represent ownership
- Mark items as Fixed when timing is pre-arranged
- Mark items as Done without hiding them
- Automatically carry forward unscheduled bucket items into the next week

## 5. Secondary Goals

- Keep the workflow close to the current Outlook process
- Reduce manual admin effort
- Improve visibility of team scheduling
- Keep the UI fast and simple
- Support lightweight automated item creation via API
- Keep technical risk low by using proven libraries and simple architecture

## 6. Non-Goals

The following are explicitly out of scope for MVP:

- Replacing Outlook across the wider business
- Storing sensitive, regulated, or confidential data
- Integration with internal systems
- Microsoft Entra ID or SSO integration
- Multi-tenant SaaS support
- Billing or commercial functionality
- Recurring work scheduling
- Spreadsheet-driven update or sync functionality
- Complex reporting or analytics
- Notifications beyond basic future optional email notifications
- Full mobile-first experience
- Per-person calendar columns
- Workflow approvals
- Advanced permissions beyond basic admin and user roles

## 7. Target Users

### Primary Users
- Operations team members who schedule and manage work

### Secondary Users
- Team managers or admins who need oversight, user management, and configuration control

## 8. Core Workflow

The intended workflow is:

1. Work items are created in the weekly bucket or directly in a calendar location via quick add
2. Items may be created manually or via a simple API call
3. Team members drag items from the bucket into a specific day or time slot
4. Team members assign ownership by selecting a user
5. Items may be marked as Fixed if timing is pre-arranged
6. Items may be marked as Done when completed
7. Done items remain visible and are not automatically hidden
8. Bucket items that remain unscheduled are automatically carried forward to the next week

## 9. MVP Feature Set

### Scheduling
- Weekly calendar view
- Weekend visibility
- Optional hide/show weekend toggle in calendar controls
- Previous week, next week, and current week navigation
- Weekly bucket for unscheduled work
- Drag from bucket into calendar
- Drag from calendar back into bucket
- Support for all-day placement
- Support for timed placement
- Support for multi-day all-day placement across the top area

### Work Item Management
- Create item manually in the UI
- Quick add creates item in the clicked location (bucket, day, or time slot)
- Create item via simple API
- Assign user
- Unassign user
- Mark item as Fixed
- Mark item as Done
- Edit item details
- Delete item, admin only

### Search and Filtering
- Fast lightweight search
- Search across title, customer, and notes
- Filter to show only current user's items

### User and Access
- Approved users only
- No public sign-up
- Email-based magic link login
- Long rolling sessions
- Admin and user roles
- Admin-managed unique user colours
- Admin-managed organization default colour for unassigned items
- Dedicated settings access for personal date format, personal theme mode (light/dark), personal calendar visible window, and admin-gated configuration controls

### Audit and Safety
- Created at and updated at timestamps
- Created by and updated by user references
- HTTPS required
- Database not publicly accessible
- No sensitive data storage

## 10. Future Scope

The following may be considered later, but are not part of MVP:

- Spreadsheet-driven item update support
- Additional API endpoints beyond create item
- Recurring work items
- Assignment email notifications
- Internal hosting option
- Richer search and filtering
- Reporting and completion metrics
- Archive/history features
- Multi-organisation support
- Commercial or external productisation
- Rebranding if the tool evolves beyond internal use

## 11. Functional Requirements

### Work Items
Each work item must support:

- Title
- Customer reference, optional
- Notes, optional
- Assignee, optional
- Colour derived from assignee
- Target week
- Date and time placement, optional
- Fixed state
- Done state
- Audit fields

### Bucket Behaviour
- Items without calendar placement appear in the bucket for the relevant week
- Bucket items are considered unscheduled
- Bucket items automatically carry forward into the next week if still unscheduled

### Calendar Behaviour
- Items can be placed on a day without time
- Items can be placed into a specific time slot
- Items can span multiple days in the all-day area
- Fixed items remain draggable but are visually distinct
- Done items remain visible in place

### Permissions
- Users can create and edit normal work items
- Admins can manage users, colours, and delete items
- User colours must be unique across the system
- User/default colours must not use reserved status colours (Fixed, On hold, Cancelled, Complete outlines)

## 12. Success Criteria

OpsScheduler MVP is successful if:

- The team can use it to manage weekly scheduling without relying on Outlook as the primary calendar board
- New work can be added quickly
- Items can be scheduled and rescheduled with minimal friction
- No sensitive data is stored
- The workflow remains easy to understand
- The application is stable, secure, and maintainable
- The team finds it at least as usable as the current Outlook-based method

## 13. Constraints

- The application should remain lightweight
- The system should be simple enough to self-host and maintain
- The UI should prioritise speed and clarity over feature density
- Custom workflow logic should remain under direct project control
- Proven libraries should be used where possible instead of custom implementations for security-critical or complex infrastructure concerns
- The underlying data model should support future multi-organisation use, but MVP will operate as a single-organisation system with no organisation management in the UI

## 14. Source of Truth

For MVP, OpsScheduler becomes the source of truth after item creation.

This means:

- External sources may create items
- Ongoing scheduling and management happens inside OpsScheduler
- Spreadsheet-driven update or sync is not included in MVP
