# WORKFLOW_RULES.md

## 1. Purpose

This document defines the core workflow rules for OpsScheduler.

These rules are the source of truth for how the system behaves.  
All implementation must follow these rules exactly.  
No changes to behaviour should be made without updating this document.

---

## 2. Core Concepts

### Work Item
A unit of work that can be:
- unscheduled (in bucket)
- scheduled (placed on calendar)
- marked as Fixed
- marked as On hold
- marked as Cancelled
- marked as Complete

### Bucket
A weekly holding area for unscheduled work items.

### Calendar
The week view where items are scheduled by day or time.

### Target Week
The week an item belongs to when unscheduled.

---

## 3. Item States

A work item can exist in the following states:

### Bucket State
- Item has no date or time assigned
- Item belongs to a target week
- Item appears in the bucket for that week

### Scheduled State
- Item has a date assigned
- May optionally have time assigned
- Appears in the calendar

### Complete State
- Item is marked as complete
- Item remains visible
- Item is not removed or hidden

---

## 4. Placement Rules

### Bucket Placement
- Items without a date must appear in the bucket
- Bucket is scoped to the selected week
- Items are grouped by target week

### Calendar Placement
- Items with a date appear in the calendar
- If no time is set, item appears as all-day
- If time is set, item appears in the time grid
- Items can span multiple days in the all-day section

---

## 5. Drag and Drop Behaviour

### Bucket to Calendar
- Dragging an item from the bucket to a day assigns that date
- Dragging into time assigns date and time
- Item moves from bucket to calendar

### Calendar to Bucket
- Dragging an item out of the calendar removes date and time
- Item returns to the bucket for its target week

### Calendar to Calendar
- Dragging between days updates date
- Dragging within time grid updates time
- Dragging across days updates placement

### Assignment via Drag
- If a user interaction defines assignment, the item assignee is updated
- Colour updates based on assignee

---

## 6. Carry Forward Rules

### Automatic Carry Forward
- Applies only to items in the bucket
- At the start of a new week, all unscheduled items move to the new current week
- Carry-forward is triggered by dashboard server load and is scoped to the signed-in user's organisation

### Non-Carry Forward
- Items already scheduled on a date do not move automatically
- Scheduled items remain on their assigned date

---

## 7. Fixed State Rules

### Definition
Fixed means the item has a committed or pre-arranged time.

### Behaviour
- Fixed items are visually distinct
- Fixed items can still be moved if necessary
- Fixed status does not prevent drag or edit
- Fixed uses red outline styling

---

## 8. On Hold State Rules

### Definition
On hold indicates work is paused.

### Behaviour
- On hold items remain visible
- On hold items are visually distinct
- On hold does not move or hide the item
- On hold can be toggled on and off
- On hold uses brown outline styling
- When both Fixed and On hold are set, On hold visual styling takes priority

---

## 9. Cancelled State Rules

### Definition
Cancelled indicates work is no longer proceeding.

### Behaviour
- Cancelled items remain visible
- Cancelled items are visually distinct
- Cancelled does not move or hide the item
- Cancelled can be toggled on and off
- Cancelled uses gray outline styling
- When Cancelled and On hold are both set, Cancelled visual styling takes priority
- When Cancelled and Fixed are both set, Cancelled visual styling takes priority

---

## 10. Complete State Rules

### Definition
Complete indicates the work has been completed.

### Behaviour
- Complete items remain visible in their current location
- Complete items are visually distinct
- Complete does not move or hide the item
- Complete can be toggled on and off
- Complete visual styling takes priority over Cancelled, On hold, and Fixed
- Complete uses green outline styling

---

## 11. Assignment Rules

### Assignee
- Each item can have one assignee
- Assignee is optional

### Colour
- Colour is derived from the assigned user
- If an item is unassigned, the organization default colour is used
- Colour cannot be manually set per item
- Each user must have a unique colour
- Organization default colour must not duplicate any user colour
- User colours and organization default colour must not use reserved status outline colours (Fixed red, On hold brown, Cancelled gray, Complete green)

---

## 12. Creation Rules

### Manual Creation
- Item can be created via UI
- Quick add in bucket creates item in bucket state
- Quick add on a day creates an all-day item on that day
- Quick add in a time slot creates a timed item in that slot
- target_week is set from the selected week context

### API Creation
- Item is created via POST request
- Default API creation (without placement context) creates the item in bucket state
- Default API creation sets target_week automatically to next week
- Placement context may be provided by in-app quick add to create directly in bucket, day, or time slot
- assignee is null
- fixed is false
- on_hold is false
- cancelled is false
- complete (done flag) is false

---

## 13. Editing Rules

- Items can be edited at any time
- Editing does not change state unless explicitly modified
- Moving item changes placement state
- Detail panel schedule range edits can move item between bucket and calendar states
- Detail panel edits autosave after changes
- Assigning changes assignee and colour
- Toggling Fixed, On hold, Cancelled, or Complete changes visual state only

---

## 14. Deletion Rules

- Only admins can delete items
- Deletion removes the item from the system
- No archive required for MVP

---

## 15. Search and Filtering Rules

### Search
- Search is real-time
- Matches title, customer, and notes
- Search does not remove non-matching items; non-matches are dimmed while matches stay prominent

### Filters
- My Items filter keeps all items visible while dimming non-assigned items
- Filters do not modify data, only visibility

---

## 16. Week Navigation Rules

- User can move between weeks
- Current week is default
- Bucket updates based on selected week
- Calendar updates based on selected week

---

## 17. Source of Truth

- After creation, OpsScheduler is the source of truth
- External systems do not update existing items in MVP
- Spreadsheet or API update flows are out of scope for MVP

---

## 18. Organisation Scope

- All work items belong to a single organisation
- All users belong to a single organisation
- All queries and operations must be scoped to the organisation

For MVP:

- The system operates as a single-organisation environment
- Organisation switching and multi-organisation behaviour are not exposed
- Organisation context is implicit and not user-configurable

---

## 19. Constraints

- No hidden state transitions
- No automatic reassignment
- No automatic scheduling
- No workflow approvals
- No dependency tracking between items

---

## 20. Non-Negotiable Rules

These rules must not be violated:

- Bucket items must always carry forward automatically
- Scheduled items must never move automatically
- Complete items must remain visible
- Fixed must not block movement
- Status visual priority must be Complete > Cancelled > On hold > Fixed
- Colour must always represent assignee
- No sensitive data must be stored
