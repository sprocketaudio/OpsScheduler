# TEST_PLAN.md

## 1. Purpose

This document defines the test plan for OpsScheduler MVP.

The goal is to verify that the system behaves correctly against the documented workflow, UI, data, security, and architectural rules.

Testing must focus on real user flows and critical business behaviour, not just whether code compiles.

---

## 2. Testing Principles

- Test the real workflow first
- Validate behaviour against documentation
- Prioritise critical paths over edge polish
- Test state transitions carefully
- Test security boundaries explicitly
- Keep tests practical and maintainable

---

## 3. Test Scope

This plan covers:

- Authentication
- Session handling
- Work item creation
- Calendar and bucket behaviour
- Drag and drop behaviour
- Assignment
- Status states (Fixed, On hold, Cancelled, Complete)
- Search and filters
- Carry forward logic
- Role and permission handling
- Organisation scoping
- Basic deployment and environment validation

This plan does not require exhaustive browser compatibility or advanced performance testing for MVP.

---

## 4. Test Types

### Manual Testing
Used for:

- UX validation
- Drag and drop behaviour
- Calendar interactions
- Visual state checks
- End-to-end workflows

### Automated Testing
Used for:

- Business logic
- Validation rules
- Permission checks
- API input handling
- Utility functions
- Critical state transitions

Automated command baseline:

- `pnpm test` runs the Vitest suite
- `pnpm verify:hardening` runs lint, typecheck, tests, Prisma validation, and build as a release gate

---

## 5. Core Test Areas

## 5.1 Authentication

### Test: Approved user can log in
- Start from logged out state
- Enter approved email
- Receive magic link
- Complete login
- Verify access granted

### Expected Result
- User is authenticated
- Protected routes are accessible
- Session is created correctly

---

### Test: Unapproved user cannot log in
- Enter email not on approved list
- Attempt login

### Expected Result
- Access is denied
- No valid session is created

---

### Test: Session persists
- Log in successfully
- Refresh page
- Reopen browser within session period

### Expected Result
- Session remains valid
- User stays signed in

---

### Test: Inactive user cannot access system
- Mark existing user as inactive
- Attempt login or access with existing session

### Expected Result
- Access is denied
- Session is rejected or invalidated

---

## 5.2 Work Item Creation

### Test: Create item manually in bucket
- Go to current week view
- Add new item by clicking in bucket
- Enter title
- Save or confirm

### Expected Result
- Item is created successfully
- Item appears in bucket
- target_week is set correctly
- Item has no calendar placement

---

### Test: Quick add item in day area
- Go to current week view
- Double-click empty day/all-day area
- Enter title
- Save or confirm

### Expected Result
- Item is created successfully
- Item appears as all-day on the selected day
- Item does not appear in bucket

---

### Test: Quick add item in time slot
- Go to current week view
- Double-click empty time slot
- Enter title
- Save or confirm

### Expected Result
- Item is created successfully
- Item appears in the selected time slot
- Item does not appear in bucket

---

### Test: Create item via API
- Send valid POST request to create endpoint
- Include required fields only

### Expected Result
- Item is created successfully
- Item appears in next week's bucket
- assignee is null
- fixed is false
- on_hold is false
- cancelled is false
- done is false

---

### Test: Create item via API with placement context
- Send valid POST request including placement context for:
  - bucket
  - calendar all-day
  - calendar timed

### Expected Result
- Item is created in the specified location
- target_week aligns with provided or derived week context
- assignee remains null
- fixed remains false
- on_hold remains false
- cancelled remains false
- done remains false

---

### Test: Reject invalid create request
- Send request with missing required title
- Send request with invalid field types
- Send request with unexpected fields

### Expected Result
- Request is rejected
- Validation error returned
- No item is created

---

## 5.3 Bucket Behaviour

### Test: Unscheduled item appears in bucket
- Create item with no date
- Load relevant week

### Expected Result
- Item appears in bucket only
- Item does not appear in calendar

---

### Test: Bucket reflects selected week
- Create items for different target weeks
- Navigate between weeks

### Expected Result
- Only matching bucket items appear for selected week

---

## 5.4 Calendar Behaviour

### Test: Scheduled all-day item appears correctly
- Place item on a day without time

### Expected Result
- Item appears in all-day section
- Item no longer appears in bucket

---

### Test: Scheduled timed item appears correctly
- Place item in time slot

### Expected Result
- Item appears in time grid at correct time
- Item no longer appears in bucket

---

### Test: Calendar visible workday window can be adjusted
- Open Settings
- Set visible start and end times in calendar view settings
- Save settings
- Return to dashboard

### Expected Result
- Calendar initially opens with viewport focused on the selected start time and sized to the selected start/end window
- Calendar time grid remains scrollable to full-day bounds (00:00 through end of day)
- Saved window persists across week navigation and session refresh

---

### Test: Calendar date picker jump navigates to selected week
- Open dashboard calendar controls
- Select a date using the calendar date picker jump input

### Expected Result
- Dashboard navigates to the week containing the selected date
- Calendar and bucket both update to that selected week context

---

### Test: User date format locale can be adjusted
- Open Settings
- Set date format locale (for example UK or US)
- Save settings
- Return to dashboard

### Expected Result
- Week/day labels and scheduler tooltip date formatting update to the selected locale
- Date locale persists across week navigation and session refresh

---

### Test: User theme mode can be adjusted
- Open Settings
- Set theme to Dark
- Save settings
- Navigate between dashboard and settings
- Set theme back to Light
- Save settings

### Expected Result
- Dark mode applies across the app when selected
- Light mode applies across the app when selected
- Selected theme persists across page refresh and navigation

---

### Test: Multi-day item spans correctly
- Create or move item to span multiple all-day dates

### Expected Result
- Item spans expected days in all-day area
- Display is correct across date range

---

## 5.5 Drag and Drop

### Test: Drag bucket item to all-day section
- Drag item from bucket to day header or all-day row

### Expected Result
- start_date is set
- time remains null
- Item appears as all-day

---

### Test: Drag bucket item to timed slot
- Drag item from bucket into time grid

### Expected Result
- start_date and time are set
- Item appears in time grid

---

### Test: Drag scheduled item back to bucket
- Drag item out of calendar and back to bucket

### Expected Result
- Date and time are cleared
- Item returns to bucket for target_week

---

### Test: Drag item between calendar days
- Move scheduled item from one day to another

### Expected Result
- Date updates correctly
- Item remains scheduled

---

### Test: Overlapping timed items render side-by-side
- Create two timed items with overlapping ranges in the same day

### Expected Result
- Both items render in reduced-width side-by-side columns
- Status outlines remain visible and correctly represent item state

---

### Test: Timed item text shows title and customer in compact layout
- Create timed items with durations around 30 minutes and 60 minutes
- Include title and customer values

### Expected Result
- Timed event card shows compact two-line text with title first and customer second
- The beginning of both title and customer is visible even at shorter durations
- Text is top-aligned and does not overlap card borders

---

### Test: Drag update endpoint persists placement
- Move an item by drag interaction (bucket -> calendar, calendar -> bucket, calendar -> calendar)
- Verify resulting fields in database via API or direct query

### Expected Result
- Placement fields (`start_date`, `start_time`, `end_date`, `end_time`) match the final drop location
- `updated_by` reflects the current user

---

### Test: Resize timed item
- Resize item duration in calendar

### Expected Result
- end_time updates correctly
- Display reflects new duration

---

### Test: Click does not trigger drag
- Click item without movement

### Expected Result
- Detail panel opens
- Item is not moved

---

### Test: Drag does not open detail panel
- Drag item beyond movement threshold

### Expected Result
- Item moves only
- Detail panel does not open

---

## 5.6 Detail Panel

### Test: Open item detail panel
- Click existing item

### Expected Result
- Detail panel opens
- Correct item data is shown

---

### Test: Edit item fields
- Change title
- Change customer
- Change notes

### Expected Result
- Changes are saved correctly
- Calendar or bucket view updates correctly

---

### Test: Edit item schedule range in detail panel
- Open item detail panel
- Set start date and optional time range
- Save changes
- Reopen and clear start date, then save

### Expected Result
- Setting schedule range moves item into the calendar with matching date/time placement
- Clearing start date removes date/time placement and returns the item to the bucket

---

### Test: Detail panel autosave writes details and schedule atomically
- Open item detail panel
- Change one detail field (for example title) and schedule fields (for example start time/end time) in the same autosave window
- Simulate a validation failure in schedule input (for example end time without start time), then correct and retry

### Expected Result
- A single `PATCH /api/items/:id` autosave mutation handles detail and schedule values together
- Invalid combined payloads are rejected with no partial persistence of either detail or schedule changes
- After correction, both detail and schedule changes persist together

---

### Test: Detail panel audit metadata is shown
- Open an existing item detail panel
- Verify created/updated actor and timestamps are displayed
- Edit the item and wait for autosave
- Drag or resize the same item while the panel is open

### Expected Result
- Panel shows Created by, Created at, Last edited by, and Last edited at values
- Last edited metadata reflects the latest successful update

---

## 5.7 Assignment

### Test: Assign user to item
- Open item detail panel
- Set assignee

### Expected Result
- assignee_id updates
- Item colour updates to assigned user colour

---

### Test: Unassign user
- Remove assignee from item

### Expected Result
- assignee_id becomes null
- Colour indicator is removed or reset appropriately

---

### Test: User colours remain unique
- Attempt to assign duplicate colour in admin flow

### Expected Result
- Duplicate colour is rejected
- Existing uniqueness rule is preserved

---

### Test: Admin can update user colours and default unassigned colour
- Log in as admin
- Open Settings
- Open a colour selector, confirm the swatch chooser expands, and pick one or more user/default colours
- Save settings

### Expected Result
- Changes persist successfully
- Updated user colours appear on assigned items
- Default colour appears on unassigned bucket/calendar items
- Default colour cannot match any user colour

---

### Test: Reserved status colours are blocked in admin colour settings
- In Settings as admin, attempt to set user/default colour to status outline colours

### Expected Result
- Save is rejected with a clear validation error
- Existing colours remain unchanged

---

## 5.8 Fixed State

### Test: Mark item as Fixed
- Toggle Fixed on an item

### Expected Result
- Fixed value updates
- Visual styling updates
- Item remains movable

---

### Test: Move Fixed item
- Drag a Fixed item to another date or time

### Expected Result
- Item moves successfully
- Fixed status remains true

---

## 5.9 On Hold State

### Test: Mark item as On hold
- Toggle On hold on an item

### Expected Result
- on_hold value updates
- Item remains visible
- Item styling changes to on-hold state
- Item remains movable
- On hold outline styling takes precedence over Fixed styling

---

## 5.10 Cancelled State

### Test: Mark item as Cancelled
- Toggle Cancelled on an item

### Expected Result
- cancelled value updates
- Item remains visible
- Item styling changes to cancelled state
- Item remains movable
- Cancelled outline styling takes precedence over On hold and Fixed styling

---

## 5.11 Done State

### Test: Mark item as Done
- Toggle Done on an item

### Expected Result
- Done value updates
- Item remains visible
- Item styling changes to done state

---

### Test: Done item remains in place
- Mark scheduled item as Done
- Refresh or revisit week

### Expected Result
- Item remains in same bucket or calendar location
- Item is not hidden or removed
- Done outline styling takes precedence over Cancelled, On hold, and Fixed styling

---

## 5.12 Search and Filters

### Test: Search by title
- Search using part of item title

### Expected Result
- Matching items remain prominent
- Non-matching items stay visible but are dimmed

---

### Test: Search by customer
- Search using customer text

### Expected Result
- Matching items remain prominent
- Non-matching items stay visible but are dimmed

---

### Test: Search by notes
- Search using notes content

### Expected Result
- Matching items remain prominent
- Non-matching items stay visible but are dimmed

---

### Test: Search highlights week navigation controls
- Enter search text that has matches in previous and/or next week
- Open the calendar date picker control and switch between day/month/year views

### Expected Result
- Previous/Current/Next week button is highlighted when that week has matches
- Date picker control is highlighted when any week has matches
- Date picker popover is highlighted when any matches exist
- Date picker day cells highlight matching dates
- Date picker month and year views highlight months/years containing matches
- Date picker month/year header is highlighted
- Date picker previous/next month arrows highlight when direct adjacent month contains matches

---

### Test: My Items filter
- Assign items to multiple users
- Enable My Items filter

### Expected Result
- Items assigned to current user remain prominent
- Items assigned to other users remain visible but are dimmed

---

## 5.13 Carry Forward

### Test: Bucket items carry forward automatically
- Leave unscheduled bucket item in prior week
- Open dashboard in next week context (or any week) to trigger carry forward on server load

### Expected Result
- Item appears in next week's bucket
- Item is not lost

---

### Test: Scheduled items do not carry forward
- Leave scheduled item in prior week
- Open dashboard in next week context (or any week) to trigger carry forward on server load

### Expected Result
- Scheduled item remains on original date
- Item does not move automatically

---

## 5.14 Permissions

### Test: Admin can delete item
- Log in as admin
- Delete item

### Expected Result
- Item is removed successfully

---

### Test: Non-admin cannot delete item
- Log in as normal user
- Attempt delete

### Expected Result
- Delete action is unavailable or denied

---

### Test: User cannot access unauthorised data
- Attempt access to another organisation's data via direct request

### Expected Result
- Access is denied
- No cross-organisation data is returned

---

## 5.15 Organisation Scoping

### Test: Queries are organisation scoped
- Seed multiple organisations
- Query items as user from one organisation

### Expected Result
- Only matching organisation data is returned

---

### Test: Organisation context is not user configurable in MVP
- Attempt to change organisation through UI or request manipulation

### Expected Result
- Operation is denied or ignored
- Current scoped organisation remains enforced

---

## 5.16 Audit Fields

### Test: created_at and updated_at are set
- Create new item
- Edit item later

### Expected Result
- created_at is set on creation
- updated_at changes on edit

---

### Test: created_by and updated_by are set
- Create item as one user
- Edit item as another user

### Expected Result
- created_by remains original user
- updated_by reflects latest editor

---

## 5.17 Deployment and Environment

### Test: HTTPS is enforced
- Access deployed app via domain

### Expected Result
- HTTPS is active
- Secure cookies function correctly

---

### Test: Database is not publicly exposed
- Attempt external direct DB access

### Expected Result
- Access is blocked

---

### Test: Required environment variables are present
- Start application in deployment environment

### Expected Result
- App starts successfully
- Missing required variables fail fast with clear error

---

### Test: Dev auth bypass role mode (local only)
- Set `AUTH_DEV_BYPASS_MODE=admin` or `AUTH_DEV_BYPASS_MODE=user` in local `.env`
- Ensure at least one matching active user exists
- Access a protected route without completing magic-link login

### Expected Result
- Route access is granted using the selected role mode
- Data access remains organization-scoped

---

### Test: Dev auth bypass is blocked in production
- Set `AUTH_DEV_BYPASS_MODE=admin` with `NODE_ENV=production`
- Run `pnpm build`, then start and access protected routes

### Expected Result
- Production build succeeds without activating bypass mode during prerender
- Production runtime does not grant bypass access and returns a clear configuration error when bypass is enabled

---

## 5.18 Audit Logging

### Test: Sign-in audit events are emitted
- Attempt sign-in with allowed and denied cases (unallowlisted or inactive user)
- Query durable audit records (AuditEvent table) after each attempt

### Expected Result
- Structured audit events are persisted for sign-in outcomes
- Events include action/outcome and actor context where available, without sensitive token data or raw denied-email values

---

### Test: Core item action audit events are emitted
- Perform item create, edit, placement change, and delete actions
- Query durable audit records (AuditEvent table)

### Expected Result
- Structured audit events are persisted for each action
- Events include actor, organisation scope, and target item identifiers

---

## 6. Regression Focus Areas

The following areas must be re-tested after any meaningful change:

- Authentication and login
- Session persistence
- Item creation
- Drag and drop
- Bucket and calendar state transitions
- Status behaviour (Fixed, On hold, Cancelled, Done)
- Carry forward logic
- Permissions and scoping

---

## 7. MVP Release Checklist

Before MVP is considered ready:

- Approved users can log in
- Sessions persist correctly
- Items can be created in bucket
- Items can be scheduled by drag and drop
- Items can be moved back to bucket
- Assignment works
- Fixed works
- On hold works
- Cancelled works
- Done works and does not hide items
- Search works
- Filters work
- Carry forward works
- Delete is restricted to admin
- Organisation scoping is enforced
- HTTPS is working
- No sensitive data is stored

---

## 8. Guiding Rule

If implementation passes technical checks but fails the documented workflow, it must be treated as a failed test.
