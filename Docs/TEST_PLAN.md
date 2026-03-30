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
- Fixed and Done states
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
- Click empty day/all-day area
- Enter title
- Save or confirm

### Expected Result
- Item is created successfully
- Item appears as all-day on the selected day
- Item does not appear in bucket

---

### Test: Quick add item in time slot
- Go to current week view
- Click empty time slot
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
- done is false

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

## 5.9 Done State

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

---

## 5.10 Search and Filters

### Test: Search by title
- Search using part of item title

### Expected Result
- Matching items appear
- Non-matching items are hidden

---

### Test: Search by customer
- Search using customer text

### Expected Result
- Matching items appear

---

### Test: Search by notes
- Search using notes content

### Expected Result
- Matching items appear

---

### Test: My Items filter
- Assign items to multiple users
- Enable My Items filter

### Expected Result
- Only items assigned to current user appear

---

### Test: Fixed filter
- Mix Fixed and non-Fixed items
- Enable Fixed filter

### Expected Result
- Only Fixed items appear

---

## 5.11 Carry Forward

### Test: Bucket items carry forward automatically
- Leave unscheduled bucket item in prior week
- Move into next week context or trigger carry forward process

### Expected Result
- Item appears in next week's bucket
- Item is not lost

---

### Test: Scheduled items do not carry forward
- Leave scheduled item in prior week
- Move into next week context or trigger carry forward process

### Expected Result
- Scheduled item remains on original date
- Item does not move automatically

---

## 5.12 Permissions

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

## 5.13 Organisation Scoping

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

## 5.14 Audit Fields

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

## 5.15 Deployment and Environment

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

## 6. Regression Focus Areas

The following areas must be re-tested after any meaningful change:

- Authentication and login
- Session persistence
- Item creation
- Drag and drop
- Bucket and calendar state transitions
- Fixed and Done behaviour
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
