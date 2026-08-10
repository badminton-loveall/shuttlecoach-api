# Implementation Plan: Coach & Student Welcome Emails

## Overview

Extend the existing `welcomeEmailService.ts` with two new render + send function pairs (coach and student), then integrate them into the coach and student controllers as fire-and-forget calls after successful creation. All code is TypeScript, backend-only.

## Tasks

- [x] 1. Add coach welcome email functions to welcomeEmailService
  - [x] 1.1 Implement `renderCoachWelcomeEmailHtml` and `sendCoachWelcomeEmail`
    - Add the `SendCoachWelcomeEmailParams` interface with fields: `coachEmail`, `coachName`, `coachUsername`, `centerName`, `resetLink`, `loginUrl`, `centerId?`
    - Implement `renderCoachWelcomeEmailHtml` as a pure exported function that returns branded HTML containing: coach name greeting, username display, password-reset CTA button (lime green #B8E135), login URL, and a brief guide listing assistant coach capabilities (view assigned students, mark attendance, log training sessions, record assessments)
    - Implement `sendCoachWelcomeEmail` following the same pattern as `sendCenterWelcomeEmail`: validate email with `isValidEmail`, render HTML, send via transporter with retry-once on failure
    - Email subject format: `Welcome to ShuttleCoach — ${centerName}`
    - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 7.1_

  - [ ]* 1.2 Write property test for coach email content round-trip
    - **Property 1: Coach Email Content Round-Trip**
    - Generate random strings for coachName, coachUsername, centerName, resetLink, loginUrl → render → verify all values present in HTML output
    - **Validates: Requirements 3.1, 3.2, 3.3, 7.3**

  - [ ]* 1.3 Write property test for brand consistency (coach)
    - **Property 4: Brand Consistency**
    - Generate random valid coach params → render → verify HTML contains #111827, #B8E135, #F9FAFB, #E5E7EB, font stack, and 600px max-width
    - **Validates: Requirements 3.5, 5.1, 5.2, 5.4**

- [x] 2. Add student welcome email functions to welcomeEmailService
  - [x] 2.1 Implement `renderStudentWelcomeEmailHtml` and `sendStudentWelcomeEmail`
    - Add the `SendStudentWelcomeEmailParams` interface with fields: `studentEmail`, `studentName`, `centerName`, `batchName?`, `centerContactInfo`, `guardianName?`, `isMinor`, `centerId?`
    - Implement `renderStudentWelcomeEmailHtml` as a pure exported function that returns branded HTML containing: student name, center name, enrolment confirmation message, batch name (if provided), center contact info
    - When `isMinor` is true and `guardianName` is provided, address the greeting to the guardian instead of the student
    - Implement `sendStudentWelcomeEmail` following the same retry-once pattern: validate email, render, send
    - Email subject format: `Welcome to ${centerName} — ShuttleCoach`
    - _Requirements: 2.1, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 7.2_

  - [ ]* 2.2 Write property test for student email content round-trip
    - **Property 2: Student Email Content Round-Trip**
    - Generate random strings for studentName, centerName, batchName, centerContactInfo → render → verify all values present in HTML output
    - **Validates: Requirements 4.1, 4.2, 4.4, 4.5, 7.3**

  - [ ]* 2.3 Write property test for guardian addressing
    - **Property 3: Guardian Addressing for Minors**
    - Generate random guardianName, render with `isMinor: true` → verify greeting contains guardianName
    - **Validates: Requirements 2.4, 4.6**

- [x] 3. Checkpoint - Verify email service functions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate welcome email into the coach controller
  - [x] 4.1 Modify `createCoach` in `src/controllers/coaches.ts` to send welcome email
    - After successful INSERT, if the coach has an email address:
      1. Import `generateResetToken` and `hashToken` from `src/utils/tokenGenerator.ts`
      2. Import `sendCoachWelcomeEmail` from `src/services/welcomeEmailService`
      3. Generate a reset token via `generateResetToken()`
      4. Store `hashToken(token)` in `password_reset_tokens` with 24-hour expiry (invalidate existing tokens for this user first)
      5. Build reset link: `${FRONTEND_URL}/reset-password?token=${token}`
      6. Build login URL: `${FRONTEND_URL}/login`
      7. Call `sendCoachWelcomeEmail(...)` without `await` (fire-and-forget)
    - If the coach has no email, skip all of the above silently
    - Wrap the email logic in a try-catch inside `setImmediate` to ensure errors never block the 201 response
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 4.2 Write unit tests for coach controller email integration
    - Test: when email is provided, `sendCoachWelcomeEmail` is called with correct params
    - Test: when email is absent, `sendCoachWelcomeEmail` is NOT called
    - Test: when email sending throws, API still returns 201
    - Test: `password_reset_tokens` row is created with correct hash and 24h expiry
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Integrate welcome email into the student controller
  - [x] 5.1 Modify `createStudent` in `src/controllers/students.ts` to send welcome email
    - After successful INSERT, if the student has an email address:
      1. Import `sendStudentWelcomeEmail` from `src/services/welcomeEmailService`
      2. Determine if student is a minor using the already-calculated `age` variable (`age < 18`)
      3. Look up the center name from the request context or via a query using `req.tenantCenterId`
      4. Look up the batch name if `batchId` was provided
      5. Get center contact info (contact email/phone from center record)
      6. Call `sendStudentWelcomeEmail(...)` without `await` (fire-and-forget)
    - If the student has no email, skip silently
    - Wrap the email logic in a try-catch inside `setImmediate` to ensure errors never block the 201 response
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.2 Write unit tests for student controller email integration
    - Test: when email is provided, `sendStudentWelcomeEmail` is called with correct params
    - Test: when email is absent, `sendStudentWelcomeEmail` is NOT called
    - Test: when student is minor, `isMinor: true` and `guardianName` are passed
    - Test: when email sending throws, API still returns 201
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All email sending is fire-and-forget — never blocks the API response
- The existing `password_reset_tokens` table is reused as-is (no migration needed)
- Token pattern follows the same approach used in `src/controllers/admin/centers.ts` for the center welcome email

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.3"] },
    { "id": 2, "tasks": ["4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "5.2"] }
  ]
}
```
