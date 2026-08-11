# Implementation Plan: Student Fee Ledger

## Overview

This plan implements a center-level financial ledger that records all monetary transactions — fee payments (credits) and salary disbursements (debits). It creates a new database table, a ledger service with date utilities, a query API with filtering and running balance, manual entry creation, and integrates with existing fee/salary controllers for automatic entry creation and reversal.

## Tasks

- [x] 1. Database migration and core types
  - [x] 1.1 Create migration file `src/migrations/021_ledger_entries.sql`
    - Create `ledger_entries` table with columns: id (UUID PK), center_id (FK → centers.id, NOT NULL), entry_type (VARCHAR(10), CHECK IN CREDIT/DEBIT), amount (NUMERIC(12,2), CHECK > 0), transaction_date (DATE, NOT NULL), description (TEXT, NOT NULL), reference_type (VARCHAR(10), CHECK IN FEE/SALARY/MANUAL), reference_id (UUID, NULLABLE), person_id (UUID, NULLABLE), person_name (VARCHAR(200), NULLABLE), payment_method (VARCHAR(20), NULLABLE), category (VARCHAR(100), NULLABLE), created_at (TIMESTAMPTZ, DEFAULT NOW())
    - Add indexes: idx_ledger_entries_center_date, idx_ledger_entries_center_person, idx_ledger_entries_reference, idx_ledger_entries_created_at
    - Add unique constraint: uq_ledger_entries_ref on (center_id, reference_type, reference_id, entry_type) WHERE reference_type != 'MANUAL'
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 Add ledger types to `src/types/index.ts`
    - Add `LedgerEntryType` enum (CREDIT, DEBIT)
    - Add `LedgerReferenceType` enum (FEE, SALARY, MANUAL)
    - Add `LedgerEntry`, `LedgerQueryFilters`, `LedgerQueryResult`, `CreateManualEntryRequest` interfaces
    - _Requirements: 3.1, 3.3, 3.4_

- [x] 2. Date utilities
  - [x] 2.1 Create `src/utils/ledgerDateUtils.ts`
    - Implement `getMonthRange(monthStr: string)` → {start, end} for YYYY-MM format
    - Implement `getQuarterRange(quarter: string, financialYear: string)` → {start, end} mapping Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
    - Implement `getFinancialYearRange(financialYear: string)` → {start, end} for YYYY-YYYY (April 1 start year to March 31 end year)
    - Implement `validateDateRange(fromDate: string, toDate: string)` → validates from <= to
    - Implement `parseFinancialYear(fy: string)` → parses and validates YYYY-YYYY format (end = start + 1)
    - _Requirements: 4.1, 5.1, 5.2, 6.1, 7.1, 7.2_

  - [ ]* 2.2 Write property test for Indian Financial Year date range correctness
    - **Property 4: Indian Financial Year date range correctness**
    - Generate random valid quarters (Q1–Q4) and financial years, verify getQuarterRange maps to correct month boundaries; verify getFinancialYearRange spans April 1 – March 31
    - **Validates: Requirements 5.2, 6.1**

  - [ ]* 2.3 Write property test for date filtering
    - **Property 5: Date filtering returns exactly matching entries**
    - Generate random sets of dates and time filters (month, quarter, FY, custom range), verify only dates within computed range are included
    - **Validates: Requirements 4.1, 5.1, 7.1**

- [x] 3. Checkpoint - Date utilities complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Ledger service — entry creation
  - [x] 4.1 Create `src/services/ledgerService.ts` with credit and debit entry creation
    - Implement `createCreditEntry(feeRecord, studentName, centerId)` — inserts CREDIT entry with fee record fields
    - Implement `createDebitEntry(salaryRecord, coachName, centerId)` — inserts DEBIT entry with salary record fields
    - Implement `hasDuplicateEntry(referenceType, referenceId, entryType, centerId)` — checks for existing entry to prevent duplicates
    - Both methods should check for duplicates before inserting and skip if already exists
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 4.2 Write property test for credit entry field preservation
    - **Property 1: Credit entry preserves fee record fields**
    - Generate random valid fee records, verify created entry has correct entry_type, amount, transaction_date, reference_type, reference_id, person_id, payment_method, center_id, and description contains student name
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**

  - [ ]* 4.3 Write property test for debit entry field preservation
    - **Property 2: Debit entry preserves salary record fields**
    - Generate random valid salary records, verify created entry has correct entry_type, amount, transaction_date, reference_type, reference_id, person_id, payment_method, center_id, and description contains coach name
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.6**

  - [ ]* 4.4 Write property test for entry creation idempotency
    - **Property 3: Entry creation is idempotent**
    - Generate random fee/salary records, invoke creation multiple times, verify exactly one entry exists per (reference_type, reference_id, entry_type, center_id) combination
    - **Validates: Requirements 1.5, 2.5**

  - [ ]* 4.5 Write property test for positive amount enforcement
    - **Property 13: Amount must be positive with two decimal precision**
    - Generate random amounts including zero, negative, and valid values, verify rejection for <= 0 and storage precision for valid amounts
    - **Validates: Requirements 3.2, 3.5**

- [x] 5. Ledger service — reversal and manual entries
  - [x] 5.1 Implement `createReversalEntry(originalEntryRef, centerId)` in ledgerService
    - For fee reversal (PAID → PENDING/OVERDUE): create DEBIT entry with same amount, reference_id pointing to original entry, description indicating reversal, transaction_date = current date
    - For salary reversal (PAID → PENDING): create CREDIT entry with same amount, reference_id pointing to original entry, description indicating reversal, transaction_date = current date
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 5.2 Implement `createManualEntry(params, centerId)` in ledgerService
    - Accept entry_type (CREDIT/DEBIT), amount, transaction_date, description, optional category and person_id/person_name
    - Set reference_type = MANUAL, validate amount > 0, validate description is present
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 5.3 Write property test for reversal entry correctness
    - **Property 12: Reversal creates opposite-type entry with matching amount**
    - Generate random paid fee/salary records, simulate reversal, verify opposite entry_type, same amount, reference_id links to original
    - **Validates: Requirements 12.1, 12.2, 12.3**

  - [ ]* 5.4 Write property test for manual entry field storage
    - **Property 14: Manual entry fields stored correctly**
    - Generate random valid manual entry requests, verify stored entry has reference_type=MANUAL and all fields preserved exactly as provided
    - **Validates: Requirements 13.2, 13.3, 13.5, 13.7**

- [x] 6. Ledger service — query with filtering and running balance
  - [x] 6.1 Implement `queryLedger(filters, centerId)` in ledgerService
    - Build dynamic SQL query with optional WHERE clauses for: month, quarter, financial_year, from_date/to_date, student_id (CREDIT entries only), coach_id (DEBIT entries only)
    - Compute running_balance using SQL window function: SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE -amount END) OVER (ORDER BY transaction_date, created_at)
    - Compute opening_balance: net of all entries before the filter period start date
    - Compute summary: totalCredits, totalDebits, netBalance
    - Order results by transaction_date ASC, created_at ASC
    - Scope all queries to center_id
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3_

  - [ ]* 6.2 Write property test for summary totals consistency
    - **Property 6: Summary totals equal aggregation of filtered entries**
    - Generate random sets of ledger entries, apply filters, verify totalCredits = sum of CREDIT amounts, totalDebits = sum of DEBIT amounts, netBalance = totalCredits - totalDebits
    - **Validates: Requirements 4.2, 5.3, 6.2, 7.3, 8.3, 9.3**

  - [ ]* 6.3 Write property test for chronological ordering
    - **Property 7: Entries are chronologically ordered**
    - Generate random ledger entries with various dates, verify output ordering: transaction_date ASC, then created_at ASC for ties
    - **Validates: Requirements 4.3, 6.3**

  - [ ]* 6.4 Write property test for tenant isolation
    - **Property 8: Tenant isolation — no cross-center leakage**
    - Generate entries across multiple centers, query with one center_id, verify no foreign center entries appear
    - **Validates: Requirements 4.4, 5.4, 6.4, 7.4, 8.4, 9.4, 11.3**

  - [ ]* 6.5 Write property test for person filter correctness
    - **Property 9: Person filter returns correctly typed entries**
    - Generate mixed CREDIT/DEBIT entries with various person_ids, filter by student_id and verify only CREDITs with matching person_id returned; filter by coach_id and verify only DEBITs returned
    - **Validates: Requirements 8.1, 9.1**

  - [ ]* 6.6 Write property test for filter composition
    - **Property 10: Filter composition is conjunction**
    - Generate entries with various dates and person_ids, apply combined person + time filter, verify result is intersection of both filters
    - **Validates: Requirements 8.2, 9.2**

  - [ ]* 6.7 Write property test for running balance calculation
    - **Property 11: Running balance is cumulative signed sum**
    - Generate random ordered entries with opening_balance, verify running_balance[i] = opening_balance + sum of signed amounts from entry[0] to entry[i]
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 7. Checkpoint - Ledger service complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Validation schemas and controller
  - [x] 8.1 Create `src/validators/ledger.schemas.ts`
    - Define Zod schema for GET /api/ledger query params: optional month (YYYY-MM regex), quarter (Q1-Q4), financial_year (YYYY-YYYY regex), from_date (YYYY-MM-DD), to_date (YYYY-MM-DD), student_id (UUID), coach_id (UUID)
    - Define Zod schema for POST /api/ledger/entries body: entry_type (CREDIT/DEBIT), amount (positive number), transaction_date (YYYY-MM-DD), description (non-empty string), optional category, optional person_id (UUID), optional person_name
    - _Requirements: 4.1, 5.1, 7.1, 7.2, 13.2_

  - [x] 8.2 Create `src/controllers/ledger.ts`
    - Implement `getLedger` handler: extract validated query params, call `queryLedger`, return JSON response with entries and summary
    - Implement `createManualEntry` handler: extract validated body, call `createManualEntry`, return 201 with created entry
    - Handle errors: 400 for validation/business rule failures, 500 for unexpected errors
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.3, 6.1, 6.2, 7.1, 7.2, 7.3, 10.1, 13.1, 13.6_

- [x] 9. Routes and middleware wiring
  - [x] 9.1 Create `src/routes/ledger.ts`
    - Define GET /api/ledger route with middleware chain: authenticate → tenantScope → requireFeeAccess → validateQuery(ledgerQuerySchema) → getLedger
    - Define POST /api/ledger/entries route with middleware chain: authenticate → tenantScope → requireFeeAccess → validateRequest(manualEntrySchema) → createManualEntry
    - _Requirements: 11.1, 11.2, 11.3, 13.6_

  - [x] 9.2 Register ledger routes in `src/routes/index.ts`
    - Import ledger router and mount at `/api/ledger`
    - _Requirements: 11.1_

- [x] 10. Integrate with existing fee and salary controllers
  - [x] 10.1 Modify `src/controllers/fees.ts` — add ledger entry on markFeePaid
    - After successful status update to PAID: call `ledgerService.createCreditEntry` with fee record data, student name, and center_id
    - On status change from PAID to PENDING/OVERDUE: call `ledgerService.createReversalEntry` with original fee reference
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 12.1, 12.3, 12.4_

  - [x] 10.2 Modify salary controller — add ledger entry on markSalaryPaid
    - After successful status update to PAID: call `ledgerService.createDebitEntry` with salary record data, coach name, and center_id
    - On status change from PAID to PENDING: call `ledgerService.createReversalEntry` with original salary reference
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.2, 12.3, 12.4_

- [x] 11. Checkpoint - Full integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Unit and integration tests
  - [ ]* 12.1 Write unit tests for access control
    - Test HEAD_COACH role gets 200 on ledger endpoints
    - Test ASSISTANT_COACH with can_access_fees permission gets 200
    - Test ASSISTANT_COACH without permission gets 403
    - Test unauthenticated request gets 401
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 12.2 Write unit tests for validation and edge cases
    - Test invalid month format returns 400
    - Test invalid quarter returns 400
    - Test invalid financial year format returns 400
    - Test from_date > to_date returns 400
    - Test manual entry with amount <= 0 returns 400
    - Test manual entry without description returns 400
    - Test manual entry without person_id succeeds
    - _Requirements: 7.2, 13.2, 13.4_

  - [ ]* 12.3 Write integration tests for fee payment → ledger credit flow
    - Test marking fee as paid creates a CREDIT ledger entry
    - Test reversal creates DEBIT entry when fee reverted to PENDING
    - Test duplicate prevention when marking same fee paid twice
    - _Requirements: 1.1, 1.5, 12.1_

  - [ ]* 12.4 Write integration tests for salary payment → ledger debit flow
    - Test marking salary as paid creates a DEBIT ledger entry
    - Test reversal creates CREDIT entry when salary reverted to PENDING
    - Test duplicate prevention when marking same salary paid twice
    - _Requirements: 2.1, 2.5, 12.2_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (14 properties total)
- Unit tests validate specific examples, edge cases, and access control
- The project uses Jest + fast-check (v4.9.0) for property-based testing
- All ledger entries are immutable — corrections use reversal entries for audit trail integrity
- Running balance is computed at query time via SQL window functions, not stored
- The date utilities module is pure (no DB dependency) and independently testable

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4", "4.5", "5.1", "5.2"] },
    { "id": 4, "tasks": ["5.3", "5.4", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "8.1"] },
    { "id": 6, "tasks": ["8.2", "9.1"] },
    { "id": 7, "tasks": ["9.2", "10.1", "10.2"] },
    { "id": 8, "tasks": ["12.1", "12.2", "12.3", "12.4"] }
  ]
}
```
