# Implementation Plan: Coach Hierarchy

## Overview

This plan implements the coach hierarchy feature across the full stack: a database migration adds `senior_coach_id` to the `users` table, the `POST /api/coaches` endpoint gains conditional role assignment and validation logic, and the frontend `AddCoachModal` is updated with a "Senior Coach" dropdown that drives the hierarchy.

## Tasks

- [x] 1. Database migration for senior_coach_id
  - [x] 1.1 Create migration file `src/migrations/020_add_senior_coach_id.sql`
    - Add nullable `senior_coach_id` UUID column to `users` table with self-referential FK and ON DELETE SET NULL
    - Add index `idx_users_senior_coach_id` on the new column
    - Add CHECK constraint `chk_no_self_reference` preventing `senior_coach_id = id`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2. Backend: Update POST /api/coaches endpoint
  - [x] 2.1 Add UUID validation utility and seniorCoachId validation logic
    - Add `isValidUUID` helper function (regex-based)
    - In `createCoach` controller, extract `seniorCoachId` from request body
    - If `seniorCoachId` is provided and non-null: validate UUID format (return 400 if invalid), query `users` table for a user with that ID having role HEAD_COACH or ASSISTANT_COACH in the same center (return 400 if not found)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 Implement conditional role assignment and update INSERT query
    - If `seniorCoachId` is absent or null: assign HEAD_COACH role, store `senior_coach_id` as NULL
    - If `seniorCoachId` is valid: assign ASSISTANT_COACH role, store `senior_coach_id` as the provided value
    - Update the INSERT statement to include `senior_coach_id` column
    - Update the response payload to include `seniorCoachId` field (or null)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.5_

  - [ ]* 2.3 Write property test for role determination (Property 2)
    - **Property 2: Role determination based on seniorCoachId presence**
    - Generate random valid payloads with and without seniorCoachId, verify role assignment logic
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 2.4 Write property test for senior coach reference validation (Property 3)
    - **Property 3: Senior coach reference validation**
    - Generate random invalid seniorCoachId values (bad UUIDs, wrong center, wrong role, non-existent), verify 400 rejection
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [ ]* 2.5 Write property test for self-reference prevention (Property 4)
    - **Property 4: Self-reference prevention**
    - Generate random user records, attempt self-reference via DB constraint, verify rejection
    - **Validates: Requirements 5.4**

- [x] 3. Checkpoint - Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend: Update AddCoachModal component
  - [x] 4.1 Add seniorCoachId to form data and update modal text
    - In `src/components/AddCoachModal.tsx`: change title to "Add Coach", subtitle to "Create a new coach account"
    - Add `seniorCoachId` field to `CoachFormData` interface
    - Accept `coaches` prop (list of existing coaches for dropdown)
    - _Requirements: 1.1, 1.3_

  - [x] 4.2 Add Senior Coach dropdown field to the form
    - Add a `<select>` field labeled "Senior Coach" with "(optional)" indicator, positioned after Profile Photo URL field
    - Populate with existing coaches sorted alphabetically by name
    - Include an empty/default option for no selection
    - Disable the dropdown during form submission
    - No required-field indicator on the dropdown
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.3 Write property test for coach dropdown filtering and sorting (Property 1)
    - **Property 1: Coach dropdown filtering and sorting**
    - Generate random user lists with various roles/centers, verify filtering to HEAD_COACH/ASSISTANT_COACH only and alphabetical sorting
    - **Validates: Requirements 2.1**

- [x] 5. Frontend: Update CoachesPage and useCoaches hook
  - [x] 5.1 Update CoachesPage button label and pass coaches to modal
    - In `src/pages/CoachesPage.tsx`: change button text to "+ Add Coach"
    - Pass the coaches list to `AddCoachModal` as a prop
    - _Requirements: 1.2_

  - [x] 5.2 Update useCoaches hook to include seniorCoachId in create payload
    - In `src/hooks/useCoaches.ts`: add `seniorCoachId` to `CreateCoachData` interface
    - Include `seniorCoachId` in the POST request body sent to `/api/coaches`
    - _Requirements: 4.1_

- [x] 6. Checkpoint - Verify welcome email continuity
  - Ensure welcome email logic still fires for both HEAD_COACH and ASSISTANT_COACH roles (no code change needed, just verify existing behavior is not broken)
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 7. Final integration and wiring
  - [x] 7.1 End-to-end verification of the full flow
    - Verify the frontend form submits `seniorCoachId` correctly to the API
    - Verify the API assigns the correct role based on seniorCoachId presence
    - Verify the response includes `seniorCoachId` and the correct role
    - Verify welcome email fires for both roles when email is provided
    - _Requirements: 3.1, 3.2, 3.4, 4.5, 6.1, 6.2_

  - [ ]* 7.2 Write integration tests for coach creation with hierarchy
    - Test 201 with HEAD_COACH when seniorCoachId is omitted
    - Test 201 with ASSISTANT_COACH when valid seniorCoachId is provided
    - Test 400 for malformed UUID, non-existent coach, wrong role, different center
    - _Requirements: 3.1, 3.2, 4.2, 4.3, 4.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The frontend app lives in a separate workspace (`/APP/shuttlecoach/`), so frontend tasks reference files there
- The welcome email service requires no code changes — it already fires for any coach creation with an email address
- The GET /api/coaches endpoint already returns all coaches (HEAD_COACH + ASSISTANT_COACH) sorted by name, so no backend change is needed for the dropdown data source

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "4.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5", "4.3", "5.1", "5.2"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["7.2"] }
  ]
}
```
