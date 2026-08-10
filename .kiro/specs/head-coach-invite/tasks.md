# Implementation Plan: Head Coach Invite

## Overview

Implement two new admin endpoints — `POST /api/admin/centers/:id/invite-head-coach` and `POST /api/admin/centers/:id/resend-head-coach-reset` — in a new controller file. The invite endpoint handles both new and existing user flows with transactional safety, conflict detection, and email retry logic. The resend endpoint regenerates a password reset token for an already-assigned head coach.

## Tasks

- [ ] 1. Create shared validation utilities
  - [ ] 1.1 Create `src/utils/validation.ts` with `isValidEmailFormat` and `isValidUUID` helpers
    - Extract email validation logic (exactly one `@`, domain with at least one dot, max 254 chars)
    - Add UUID format validation using regex
    - Export both functions for use across controllers
    - _Requirements: 3.2, 3.3_

- [ ] 2. Extend the email service with head coach notification email
  - [ ] 2.1 Add `sendHeadCoachNotificationEmail` to `src/services/welcomeEmailService.ts`
    - Create `renderHeadCoachNotificationEmailHtml` for existing-user flow (no reset link, login URL + center name)
    - Create `sendHeadCoachNotificationEmail` function with same retry-once pattern as existing email functions
    - Accept params: `email`, `userName`, `centerName`, `loginUrl`, `centerId`
    - _Requirements: 2.2, 7.1_

- [ ] 3. Implement the invite head coach controller
  - [ ] 3.1 Create `src/controllers/admin/headCoachInvite.ts` with `inviteHeadCoach` function
    - Validate request body: email required, valid format, max 254 chars
    - Validate center ID path param as UUID
    - Query center existence (404 if not found)
    - Check for existing HEAD_COACH membership at the center (409 if different user)
    - Case-insensitive user lookup by email
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1_

  - [ ] 3.2 Implement the new-user flow within `inviteHeadCoach`
    - Wrap in BEGIN/COMMIT/ROLLBACK transaction
    - INSERT new user with lowercased email as both email and username, role HEAD_COACH, no password
    - Generate reset token, hash with SHA-256, store with 24-hour expiry
    - INSERT `user_center_memberships` row (user_id, center_id, role=HEAD_COACH)
    - COMMIT, then attempt email delivery with retry-once (5s delay)
    - Return 201 with `{ userId, email, centerId, isNewUser: true, warning? }`
    - On transaction failure: ROLLBACK and return 500
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.2, 7.4_

  - [ ] 3.3 Implement the existing-user flow within `inviteHeadCoach`
    - Check if user already has HEAD_COACH membership at this center (409 if so)
    - Check if user has a different-role membership at this center → UPDATE role to HEAD_COACH
    - Otherwise INSERT new `user_center_memberships` row with HEAD_COACH role
    - Attempt notification email with retry-once (5s delay)
    - Return 200 with `{ userId, email, centerId, isNewUser: false, warning? }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.2, 4.3, 7.1, 7.2, 7.3_

  - [ ] 3.4 Implement `resendHeadCoachReset` function in the same controller
    - Validate center ID as UUID (400 if invalid)
    - Query center existence (404 if not found)
    - Query HEAD_COACH membership for the center (422 if none)
    - Delete existing `password_reset_tokens` for that user
    - Generate new token with 24-hour expiry, store hashed
    - Send password reset email with retry-once pattern
    - Return 200 with `{ email, centerId, warning? }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 4. Register new routes in admin router
  - [ ] 4.1 Add route registrations in `src/routes/admin.ts`
    - Import `inviteHeadCoach` and `resendHeadCoachReset` from `../controllers/admin/headCoachInvite`
    - Register `POST /centers/:id/invite-head-coach` → `inviteHeadCoach`
    - Register `POST /centers/:id/resend-head-coach-reset` → `resendHeadCoachReset`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 5. Checkpoint — Verify build and manual smoke test
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Write tests for the head coach invite feature
  - [ ]* 6.1 Write property test for email case normalization
    - **Property 1: Email case normalization**
    - Generate random mixed-case valid emails, assert user is created with lowercased email/username
    - **Validates: Requirements 1.1**

  - [ ]* 6.2 Write property test for token hash and expiry correctness
    - **Property 2: New user token has correct hash and 24-hour expiry**
    - For any new user invite, verify stored token_hash equals SHA-256(rawToken) and expires_at is within ±1 minute of now + 24h
    - **Validates: Requirements 1.2**

  - [ ]* 6.3 Write property test for new user invite creates correct records
    - **Property 3: New user invite creates user, membership, and returns 201**
    - For any valid email not matching existing user + valid center without head coach, verify user row, membership row, and 201 response
    - **Validates: Requirements 1.3, 1.5**

  - [ ]* 6.4 Write property test for existing user invite
    - **Property 4: Existing user invite creates membership, returns 200, no token**
    - For any matching existing user + valid center, verify membership created, 200 returned, no new token row
    - **Validates: Requirements 2.1, 2.3, 2.4**

  - [ ]* 6.5 Write property test for invalid email rejection
    - **Property 5: Invalid email format rejected**
    - Generate random non-email strings, assert 400 returned with no DB changes
    - **Validates: Requirements 3.2, 1.7**

  - [ ]* 6.6 Write property test for invalid UUID rejection
    - **Property 6: Invalid center ID format rejected**
    - Generate random non-UUID strings as center ID, assert 400 returned
    - **Validates: Requirements 3.3**

  - [ ]* 6.7 Write property test for conflict detection (existing head coach)
    - **Property 7: Center with existing different head coach returns 409**
    - For any center with existing HEAD_COACH membership for a different user, assert 409 and no new membership
    - **Validates: Requirements 4.1**

  - [ ]* 6.8 Write property test for duplicate head coach returns 409
    - **Property 8: User already head coach of same center returns 409**
    - For any user already HEAD_COACH at target center, assert re-invocation returns 409
    - **Validates: Requirements 4.2**

  - [ ]* 6.9 Write property test for membership role upgrade
    - **Property 9: Existing membership role upgrade**
    - For any user with non-HEAD_COACH membership at center, assert role is updated (not duplicated)
    - **Validates: Requirements 4.3**

  - [ ]* 6.10 Write property test for transactional rollback
    - **Property 10: Transactional rollback on failure**
    - Inject failures at random transaction steps, verify zero new rows remain after rollback
    - **Validates: Requirements 1.6**

  - [ ]* 6.11 Write property test for data persistence despite email failure
    - **Property 11: Data persisted regardless of email outcome**
    - For any successful invite with email failure, verify user + membership rows exist and success response returned
    - **Validates: Requirements 7.2, 7.4**

  - [ ]* 6.12 Write property test for reset endpoint token refresh
    - **Property 12: Reset endpoint invalidates old tokens and creates fresh 24-hour token**
    - For any center with assigned head coach, verify old tokens deleted and new token has correct expiry
    - **Validates: Requirements 5.1**

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses TypeScript with the existing Express/PostgreSQL stack
- Auth middleware (`authenticate` + `authorize(UserRole.ADMIN)`) is already applied at router level — no per-endpoint auth code needed
- Email delivery happens AFTER database COMMIT to ensure data persistence regardless of email outcome
- The `sendHeadCoachNotificationEmail` is the only new email function needed; the existing `sendCenterWelcomeEmail` handles the new-user flow

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11", "6.12"] }
  ]
}
```
