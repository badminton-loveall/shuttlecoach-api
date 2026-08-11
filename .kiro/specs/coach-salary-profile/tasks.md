# Implementation Plan: Coach Salary Profile

## Overview

This plan extends the coach profile with detailed personal/professional fields, creates the `salary_records` table, and adds salary generation, listing, and coach-specific history endpoints to the existing salary controller. The implementation modifies existing files (coaches controller, coach validators, coaches routes) and creates new files (salary schemas, salary routes, migration 022).

## Tasks

- [x] 1. Database migration for extended coach fields and salary_records table
  - [x] 1.1 Create migration file `src/migrations/022_coach_salary_profile.sql`
    - Add nullable columns to `users` table: phone (VARCHAR 20), date_of_birth (DATE), address (TEXT), qualification (TEXT), experience_years (INTEGER), bank_details (TEXT), monthly_salary (NUMERIC 10,2)
    - Create `salary_records` table with id, coach_user_id, amount, salary_period, status, payment_date, payment_method, center_id, created_at
    - Add UNIQUE constraint on (coach_user_id, salary_period)
    - Add CHECK constraint on status IN ('PENDING', 'PAID')
    - Add indexes on coach_user_id, center_id, salary_period, status
    - _Requirements: 4.1, 4.2, 4.3, 12.1, 12.2, 12.3_

- [x] 2. Extend coach validators with profile fields
  - [x] 2.1 Update `src/validators/coach.schemas.ts` with extended fields
    - Add optional fields to `createCoachSchema`: phone, dateOfBirth, address, qualification, experienceYears, bankDetails, monthlySalary
    - Create `updateCoachSchema` for PATCH requests accepting any subset of extended fields plus name, email, specialization, profilePhoto
    - Add validation: monthlySalary must be positive number or null (reject zero/negative)
    - Export `UpdateCoachInput` type
    - _Requirements: 1.1, 1.3, 3.1, 3.2_

  - [x] 2.2 Create `src/validators/salary.schemas.ts` for salary generation and query schemas
    - Define `generateSalarySchema` with period field (regex YYYY-MM, valid month 01-12)
    - Define `listSalaryQuerySchema` with optional period filter
    - Define `coachSalaryQuerySchema` with optional period filter
    - _Requirements: 6.3_

- [x] 3. Extend coaches controller with getCoach and updated create/update logic
  - [x] 3.1 Update `createCoach` in `src/controllers/coaches.ts` to persist extended fields
    - Extract extended fields (phone, dateOfBirth, address, qualification, experienceYears, bankDetails, monthlySalary) from request body
    - Include them in the INSERT query as nullable columns
    - Return extended fields in the response
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 3.2 Update `updateCoach` in `src/controllers/coaches.ts` to handle extended fields
    - Accept extended fields in addition to existing updatable fields
    - Use dynamic query building for PATCH semantics (only update provided fields)
    - Validate monthlySalary is positive or null if provided
    - Return full profile with all fields in response
    - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.4_

  - [x] 3.3 Add `getCoach` handler to `src/controllers/coaches.ts`
    - Query single coach by ID scoped to requesting user's center_id
    - Return full profile including all extended fields
    - Return 404 if coach not found in user's center
    - Allow ASSISTANT_COACH to access their own profile (check req.user.id === params.id)
    - Return 403 if ASSISTANT_COACH tries to access another coach's profile
    - _Requirements: 2.1, 2.2, 2.3, 11.2_

  - [ ]* 3.4 Write property test for coach profile round-trip
    - **Property 1: Coach profile round-trip**
    - Generate random coach profiles with any combination of extended fields, create via controller, retrieve by ID, assert all provided fields match
    - **Validates: Requirements 1.1, 1.2, 1.4, 2.1**

  - [ ]* 3.5 Write property test for partial update preserving unmodified fields
    - **Property 2: Partial update preserves unmodified fields**
    - Generate random existing profiles and random subsets of fields for PATCH, verify only specified fields change
    - **Validates: Requirements 1.3**

  - [ ]* 3.6 Write property test for monthly salary validation
    - **Property 4: Monthly salary validation**
    - Generate random numeric values (positive, zero, negative, null), verify accept/reject behavior
    - **Validates: Requirements 3.1, 3.2**

- [x] 4. Checkpoint - Coach profile extensions complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend salary controller with generateSalary, listSalary, getCoachSalary
  - [x] 5.1 Add `generateSalary` handler to `src/controllers/salary.ts`
    - Accept period (YYYY-MM) from request body
    - Query all coaches in the center with non-null monthly_salary
    - For each eligible coach, check if salary_record already exists for that period
    - Insert PENDING salary record with amount = coach's current monthly_salary
    - Return summary: { created, skipped, period }
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.4_

  - [x] 5.2 Add `listSalary` handler to `src/controllers/salary.ts`
    - Accept optional period query param (default to current month YYYY-MM)
    - Query salary_records for the period, scoped to center_id
    - JOIN with users table to include coach name
    - Order by coach name ascending
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.3 Add `getCoachSalary` handler to `src/controllers/salary.ts`
    - Accept coachId from route param and optional period query param
    - Verify coach belongs to the requesting user's center (404 if not)
    - Query salary_records for the coach, ordered by salary_period descending
    - Filter by period if provided
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 5.4 Write property test for salary generation correctness
    - **Property 6: Salary generation correctness**
    - Generate random coach sets (some with monthly_salary, some without), trigger generation, verify exactly one PENDING record per eligible coach with correct amount and center_id
    - **Validates: Requirements 5.1, 5.2, 5.4, 6.1**

  - [ ]* 5.5 Write property test for salary generation idempotence
    - **Property 7: Salary generation idempotence**
    - Run generation twice for same center/period, verify second run creates zero records and skips all
    - **Validates: Requirements 5.5**

  - [ ]* 5.6 Write property test for generation summary invariant
    - **Property 8: Generation summary invariant**
    - Verify created + skipped = total eligible coaches for any generation run
    - **Validates: Requirements 5.6**

  - [ ]* 5.7 Write property test for period format validation
    - **Property 9: Period format validation**
    - Generate strings that do/don't match YYYY-MM format, verify endpoint acceptance/rejection
    - **Validates: Requirements 6.3**

- [x] 6. Checkpoint - Salary controller extensions complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Routes: Add salary routes and update coach routes
  - [x] 7.1 Create `src/routes/salary.ts`
    - POST /generate — authenticate, centerActive, tenantScope, authorize(HEAD_COACH), validateRequest(generateSalarySchema), generateSalary
    - GET / — authenticate, centerActive, tenantScope, authorize(HEAD_COACH), listSalary
    - GET /coach/:coachId — authenticate, centerActive, tenantScope, authorize(HEAD_COACH), getCoachSalary
    - PATCH /:id/pay — authenticate, centerActive, tenantScope, authorize(HEAD_COACH), markSalaryPaid
    - PATCH /:id/revert — authenticate, centerActive, tenantScope, authorize(HEAD_COACH), revertSalaryPaid
    - _Requirements: 6.1, 6.2, 9.1, 10.1, 11.1_

  - [x] 7.2 Register salary routes in `src/routes/index.ts`
    - Import salary router and mount at `/api/salary`
    - _Requirements: 6.1_

  - [x] 7.3 Update `src/routes/coaches.ts` to add GET /:id route
    - Add GET /:id route before PATCH /:id to avoid route conflicts
    - Apply authenticate, centerActive, tenantScope middleware (already applied via router.use)
    - Allow both HEAD_COACH and ASSISTANT_COACH (remove blanket authorize for this route, handle in controller)
    - Wire to getCoach handler
    - _Requirements: 2.1, 11.2_

- [ ] 8. Access control and tenant isolation
  - [ ]* 8.1 Write property test for tenant isolation
    - **Property 3: Tenant isolation**
    - Generate coaches/salary records in center A, query from center B, verify 404/empty results
    - **Validates: Requirements 2.2, 6.4, 7.5, 8.4, 9.5, 10.4, 11.4**

  - [ ]* 8.2 Write property test for role-based write access restriction
    - **Property 5: Role-based write access restriction**
    - Generate requests from non-HEAD_COACH users for write operations, verify 403 rejection
    - **Validates: Requirements 3.3, 6.2, 11.1, 11.3**

  - [ ]* 8.3 Write property test for assistant coach self-access
    - **Property 13: Assistant coach self-access**
    - Generate ASSISTANT_COACH users, verify GET own profile returns 200, GET other coach returns 403
    - **Validates: Requirements 11.2**

- [ ] 9. Salary pay/revert property tests
  - [ ]* 9.1 Write property test for pay operation correctness
    - **Property 11: Pay operation correctness**
    - Generate PENDING salary records, apply pay with valid paymentDate/paymentMethod, verify PAID status + ledger DEBIT entry. Verify already-PAID records return 400.
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

  - [ ]* 9.2 Write property test for revert operation correctness
    - **Property 12: Revert operation correctness**
    - Generate PAID salary records, apply revert, verify PENDING status + cleared fields + ledger CREDIT entry. Verify non-PAID records return 400.
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [ ] 10. Salary list ordering property test
  - [ ]* 10.1 Write property test for salary list ordering and completeness
    - **Property 10: Salary list ordering and completeness**
    - Generate salary records across multiple periods/centers, query for specific period, verify response only contains matching period/center records, sorted by coach name ascending
    - **Validates: Requirements 7.1, 7.3, 7.4**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (13 properties)
- The project uses Jest + fast-check for property-based testing
- The existing `markSalaryPaid` and `revertSalaryPaid` in `src/controllers/salary.ts` remain unchanged — new handlers are added alongside them
- The coaches route currently applies `authorize(HEAD_COACH)` via `router.use()` — the GET /:id route will need special handling to allow ASSISTANT_COACH self-access
- No salary routes file exists yet — it needs to be created and registered in the routes index
- There is no existing `updateCoachSchema` in the validators — it needs to be created

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5", "3.6", "5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["5.4", "5.5", "5.6", "5.7", "7.1", "7.3"] },
    { "id": 5, "tasks": ["7.2"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "9.1", "9.2", "10.1"] }
  ]
}
```
