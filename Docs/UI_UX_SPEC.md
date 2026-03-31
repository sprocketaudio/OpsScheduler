# UI_UX_SPEC.md

## 1. Purpose

This document defines the user interface and interaction behaviour for OpsScheduler.

The goal is to ensure the UI is fast, intuitive, and consistent with the current workflow, while improving usability over Outlook.

All UI behaviour must follow this specification.

---

## 2. Core Layout

The main screen consists of three primary areas:

1. Top Navigation Bar
2. Weekly Calendar View
3. Weekly Bucket (unscheduled items)

---

## 3. Top Navigation Bar

The top bar must include:

- Current week display (e.g. "Week commencing 16 Jun 2026")
- Search input
- Filter toggles:
  - My Items
- Settings access
- Signed-in user identity display (email or display name)
- Optional display of organisation name in a non-interactive format

Settings must include:

- User-level date format (locale) control
- User-level theme mode control (Light / Dark)
- User-level calendar visible window controls (start and end time)
- Admin-only colour management:
  - per-user assignee colour selection
  - organization default colour selection for unassigned items
  - compact fixed swatch palette (around 8-10 options)
  - each selector shows the current colour and expands to a swatch chooser on click

---

## 4. Calendar View

### Structure

- 7-day week view (Monday to Sunday)
- Weekend days must be visible by default
- A calendar control can hide/show weekend columns without changing overall calendar width; weekday columns expand to fill available space when weekends are hidden
- Calendar time grid should default to a workday-focused visible window (08:00-20:00), user-adjustable in Settings
- Time grid must remain vertically scrollable to the full-day range (00:00 through end of day) even when a narrower visible window is configured
- Each day has:
  - All-day section (top)
  - Time grid (below)

### Behaviour

- All-day section supports:
  - single day items
  - multi-day spanning items

- Time grid supports:
  - timed items
  - drag and resize
  - overlapping timed items rendered side-by-side (non-overlapping visual mode)
  - overlap stack capped to a small maximum with "+more" overflow indicator
  - hover tooltip showing schedule, title, notes (when present), and status

---

## 5. Bucket (Unscheduled Items)

### Structure

- Displays items with no date/time
- Scoped to selected week (target_week)
- Appears either:
  - above calendar, or
  - in a side panel (implementation choice)

### Behaviour

- Items are listed vertically
- Items can be dragged into calendar
- Items remain until scheduled or deleted
- Items automatically carry forward to next week
- Bucket panel helper text should state that unscheduled items carry over each week
- The bucket drop zone must stretch to the bottom of the bucket panel so drop targeting remains large even with few items

---

## 6. Work Item Display

Each item must display:

- Title (primary)
- Customer (if present)
- Assignee indicator:
  - colour (background or border)
  - optional initials/avatar
- Fixed indicator (visual highlight, e.g. red)
- On hold indicator (visual highlight, e.g. brown)
- Cancelled indicator (visual highlight, e.g. gray)
- Complete indicator (visual status)

### Visual Rules

- Colour always represents assignee
- Unassigned items use the organization default colour
- Fixed must be visually distinct (e.g. red border or fill)
- Complete must be visually distinct and still readable
- Timed items should use a compact two-line text block when customer is present:
  - line 1 = title (start of text visible)
  - line 2 = customer (start of text visible)
- Compact text should remain top-aligned within the event body without touching the border
- Calendar and bucket item status must use outline colour only (no status badges)
- Fixed uses a red outline
- On hold uses a brown outline
- Cancelled uses a gray outline
- Complete uses a green outline
- Outline priority is: Complete > Cancelled > On hold > Fixed
- Cancelled and On hold should render with reduced opacity to communicate inactive state

---

## 7. Interaction Model

### Click vs Drag

- Click (no movement):
  - opens detail panel
- Drag (movement above threshold):
  - moves item
- Click must never trigger drag
- Drag must never open detail panel

---

## 8. Detail Panel

Opening an item displays a panel (side or modal) with:

- Title (editable)
- Customer (editable)
- Notes field
- Start date/time with optional end date/time (editable schedule range)
- Assignee (select user)
- Fixed toggle
- On hold toggle
- Cancelled toggle
- Complete toggle
- Delete button (admin only)
- Read-only audit metadata:
  - Created by / Created at
  - Last edited by / Last edited at
- Date fields must use the shared calendar picker component used by week navigation controls

### Behaviour

- Changes autosave after edits (no explicit save button required)
- Panel can be closed without navigation
- Side detail panel is non-modal: the main UI remains visible and interactive while the panel is open
- Selecting another item by click or drag updates the open panel to that item

---

## 9. Quick Add

### Behaviour

- Calendar quick add:
  - double-click empty day or time slot
  - opens a lightweight quick-add prompt
- Bucket quick add:
  - click explicit quick-add control in the bucket panel
  - opens a lightweight quick-add prompt
- User types title
- Press enter:
  - creates item in that location

### Rules

- No full form required
- Minimal friction
- Quick-add UI must not shift the main calendar or bucket layout when opened
- Item is created in the location clicked (bucket, day, or time slot)
- Additional details added later via panel

---

## 10. Drag and Drop

### Bucket to Calendar

- Drag item from bucket to:
  - day → all-day placement
  - time → timed placement

### Calendar to Bucket

- Drag item out of calendar:
  - removes date/time
  - returns to bucket

### Calendar to Calendar

- Drag between days updates date
- Drag within time grid updates time
- Resize adjusts duration

---

## 11. Assignment

### Methods

- Assign via detail panel
- Optional future:
  - assign via drag interaction

### Rules

- Assignee defines colour
- Only one assignee per item
- Admins can manage per-user colours and organization default colour in Settings
- Reserved status outline colours cannot be selected for user/default colours

---

## 12. Status Flags

### Fixed

- Toggle in detail panel
- Visual indicator (e.g. red)
- Does not block movement

### On Hold

- Toggle in detail panel
- Visual indicator (brown outline)
- Does not block movement

### Cancelled

- Toggle in detail panel
- Visual indicator (gray outline)
- Does not block movement

### Complete

- Toggle in detail panel
- Item remains visible
- Item appears with complete status styling
- Complete visual state overrides Cancelled, On hold, and Fixed visual states
- Cancelled visual state overrides On hold and Fixed visual states
- On hold visual state overrides Fixed visual state

---

## 13. Search

### Behaviour

- Real-time search as user types
- Matches:
  - title
  - customer
  - notes
- Matching items remain visually prominent
- Non-matching items remain visible but dimmed

### Results

- Does not remove non-matching items from the view
- Does not modify data

---

## 14. Filters

### My Items

- Items assigned to current user remain prominent
- Items assigned to other users remain visible but dimmed

### Rules

- Filters are toggleable
- Filters affect visibility only
- Active My Items button styling should use the same amber highlight palette used for active search state

---

## 15. Week Navigation

- Previous and next week controls in the calendar panel (top right)
- Current week shortcut in the calendar panel
- Date picker jump control in the calendar panel to select any date and navigate to that week
- Hide/show weekend toggle in the calendar panel
- Calendar and bucket update together
- Week/day labels and scheduler tooltip dates use the signed-in user's selected date locale
- A visual divider should separate Friday from Saturday when weekends are visible
- When search is active:
  - Previous/Current/Next week controls are highlighted when matching items exist in those weeks
  - Date picker control is highlighted when matching items exist in any week
  - Date picker popover is highlighted when matches exist
  - Date picker day cells highlight matching dates
  - Date picker month and year views highlight months/years that contain matching dates
  - Date picker month/year header is highlighted
  - Date picker previous/next month arrow controls are highlighted when the direct adjacent month contains matches

---

## 16. Visual Priorities

The UI must prioritise:

- Clarity over density
- Speed over feature depth
- Visual ownership (colour)
- Minimal clicks

---

## 17. Visual Design Direction

The UI must feel modern, clean, and responsive without becoming decorative or heavy.

### Design Goals

- Clean and professional appearance
- Modern web application feel
- Fast and lightweight interaction
- Clear hierarchy and spacing
- Strong contrast and readability
- Minimal clutter
- Consistent styling across all screens

### Typography Rules

- Use a single modern sans-serif font across the application UI
- MVP baseline font: Manrope (applied globally through `next/font`)
- Typography must prioritise readability and consistent spacing over stylistic variation

### Colour Rules

- Assignee colour is functional and must remain clearly visible
- Fixed items must be visually distinct from normal items
- Complete items must remain visible and clearly marked
- Base UI colours must remain neutral so assignee colours stand out
- Avoid high saturation, noisy backgrounds, or decorative gradients

### Component and Layout Rules

- Use consistent spacing and alignment throughout
- Desktop and laptop layouts must feel correctly scaled at 100% browser zoom (users should not need to zoom out to 90% for workable density)
- Responsive breakpoints must optimize practical laptop resolutions (for example ~1200px to ~1700px viewport widths) so core dashboard content does not require manual browser zoom to fit comfortably
- Prefer card, panel, and sheet patterns over dense layouts
- Inputs, buttons, and panels must feel modern but understated
- Motion and animation must be subtle and only used to improve clarity
- Default to simplicity over visual styling when unsure

### Non-Goals

- No flashy or novelty-driven styling
- No dense enterprise-style clutter
- No visual treatment that reduces readability or scheduling clarity
- No animation used purely for decoration

---

## 18. Mobile Considerations

- Must be readable on mobile
- Drag and drop may be limited
- Core actions (view, edit, quick add) must remain usable

---

## 19. Non-Goals

The UI must not include:

- Complex forms for creation
- Multi-step workflows
- Overloaded menus
- Per-person calendar columns
- Hidden state or unclear interactions

---

## 20. Consistency Rules

- All interactions must be predictable
- No unexpected state changes
- Visual indicators must always match data state
- UI must remain consistent across views
