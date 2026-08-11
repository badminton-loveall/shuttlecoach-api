# Requirements Document

## Introduction

This feature introduces a center-level financial ledger that records all monetary transactions — fee payments received from students (credits) and salary disbursements to coaches (debits). The ledger provides a unified accounts/balance sheet view with filtering by time period (month, quarter, financial year, custom date range), by student, and by coach. It also integrates with the existing fee and salary workflows so that marking a fee as paid or a salary as disbursed automatically creates the corresponding ledger entry.

## Glossary

- **Ledger_Service**: The backend service responsible for creating, querying, and managing ledger entries scoped to a center.
- **Ledger_Entry**: A single financial transaction record containing amount, type (CREDIT or DEBIT), reference to the source record, transaction date, and description.
- **Credit**: A ledger entry representing money received by the center (fee payment from a student).
- **Debit**: A ledger entry representing money paid out by the center (salary disbursement to a coach).
- **Running_Balance**: The cumulative net amount (total credits minus total debits) computed chronologically across ledger entries.
- **Financial_Year**: The Indian financial year running from April 1 to March 31 of the following calendar year.
- **Quarter**: A three-month period within a Financial_Year (Q1: Apr–Jun, Q2: Jul–Sep, Q3: Oct–Dec, Q4: Jan–Mar).
- **Fee_Record**: An existing entry in the `fee_records` table representing an amount owed or paid by a student.
- **Salary_Record**: An entry representing a salary amount owed to or paid to a coach.
- **Center**: The multi-tenant unit (academy/club) that scopes all ledger operations.
- **Balance_Sheet_API**: The API endpoint that returns filtered ledger entries along with summary totals and running balance.
- **Manual_Entry**: A ledger entry with reference_type MANUAL, created directly by a user to record miscellaneous income or expense not tied to a Fee_Record or Salary_Record (e.g., extra class charges, coach bonuses, equipment purchases).

## Requirements

### Requirement 1: Create Credit Ledger Entry on Fee Payment

**User Story:** As a head coach, I want a credit entry automatically added to the ledger when I mark a student's fee as paid, so that all income is tracked in a single financial record.

#### Acceptance Criteria

1. WHEN a Fee_Record status is updated to PAID, THE Ledger_Service SHALL create a Credit Ledger_Entry with the Fee_Record amount, the paid_date as the transaction date, and the student's name and fee period in the description.
2. THE Ledger_Service SHALL associate the Ledger_Entry with the Fee_Record ID as a source reference.
3. THE Ledger_Service SHALL associate the Ledger_Entry with the student_id from the Fee_Record.
4. THE Ledger_Service SHALL associate the Ledger_Entry with the center_id of the Fee_Record for tenant scoping.
5. IF a Credit Ledger_Entry already exists for the same Fee_Record ID, THEN THE Ledger_Service SHALL skip creation to prevent duplicate entries.
6. THE Ledger_Service SHALL store the payment_method from the Fee_Record on the Ledger_Entry.

### Requirement 2: Create Debit Ledger Entry on Salary Payment

**User Story:** As a head coach, I want a debit entry automatically added to the ledger when I mark a coach's salary as paid, so that all expenses are tracked alongside income.

#### Acceptance Criteria

1. WHEN a Salary_Record status is updated to PAID, THE Ledger_Service SHALL create a Debit Ledger_Entry with the Salary_Record amount, the payment date as the transaction date, and the coach's name and salary period in the description.
2. THE Ledger_Service SHALL associate the Ledger_Entry with the Salary_Record ID as a source reference.
3. THE Ledger_Service SHALL associate the Ledger_Entry with the coach's user_id.
4. THE Ledger_Service SHALL associate the Ledger_Entry with the center_id of the Salary_Record for tenant scoping.
5. IF a Debit Ledger_Entry already exists for the same Salary_Record ID, THEN THE Ledger_Service SHALL skip creation to prevent duplicate entries.
6. THE Ledger_Service SHALL store the payment_method from the Salary_Record on the Ledger_Entry.

### Requirement 3: Ledger Entry Data Structure

**User Story:** As a head coach, I want each ledger entry to contain complete transaction details, so that I can understand the context of every financial movement without looking up other tables.

#### Acceptance Criteria

1. THE Ledger_Service SHALL store each Ledger_Entry with the following fields: id (UUID), center_id, entry_type (CREDIT or DEBIT), amount (numeric, two decimal places), transaction_date (date), description (text), reference_type (FEE, SALARY, or MANUAL), reference_id (UUID of source record, nullable for MANUAL entries), person_id (UUID of student or coach, nullable for MANUAL entries), person_name (text, nullable for MANUAL entries), payment_method, category (text, nullable), and created_at (timestamp).
2. THE Ledger_Service SHALL enforce that amount is greater than zero for all Ledger_Entries.
3. THE Ledger_Service SHALL enforce that entry_type is one of CREDIT or DEBIT.
4. THE Ledger_Service SHALL enforce that reference_type is one of FEE, SALARY, or MANUAL.
5. THE Ledger_Service SHALL store all amounts in INR with two decimal places.

### Requirement 4: Balance Sheet Query by Month

**User Story:** As a head coach, I want to view the ledger filtered by a specific month, so that I can see all transactions and the net balance for that period.

#### Acceptance Criteria

1. WHEN a GET request is made to the Balance_Sheet_API with a month parameter (format: YYYY-MM), THE Ledger_Service SHALL return all Ledger_Entries with transaction_date within that calendar month.
2. THE Ledger_Service SHALL return the total credits, total debits, and net balance (credits minus debits) for the filtered period.
3. THE Ledger_Service SHALL return entries ordered by transaction_date ascending, then by created_at ascending.
4. THE Ledger_Service SHALL scope the query to the requesting user's center_id.

### Requirement 5: Balance Sheet Query by Quarter

**User Story:** As a head coach, I want to view the ledger filtered by a financial quarter, so that I can review quarterly performance.

#### Acceptance Criteria

1. WHEN a GET request is made to the Balance_Sheet_API with a quarter parameter (format: Q1, Q2, Q3, or Q4) and a financial_year parameter (format: YYYY-YYYY, e.g., 2024-2025), THE Ledger_Service SHALL return all Ledger_Entries with transaction_date within the corresponding three-month period.
2. THE Ledger_Service SHALL map quarters to the Indian Financial_Year: Q1 is April–June, Q2 is July–September, Q3 is October–December, Q4 is January–March.
3. THE Ledger_Service SHALL return the total credits, total debits, and net balance for the filtered quarter.
4. THE Ledger_Service SHALL scope the query to the requesting user's center_id.

### Requirement 6: Balance Sheet Query by Financial Year

**User Story:** As a head coach, I want to view the ledger for an entire financial year, so that I can assess annual financial performance.

#### Acceptance Criteria

1. WHEN a GET request is made to the Balance_Sheet_API with a financial_year parameter (format: YYYY-YYYY, e.g., 2024-2025), THE Ledger_Service SHALL return all Ledger_Entries with transaction_date from April 1 of the start year to March 31 of the end year.
2. THE Ledger_Service SHALL return the total credits, total debits, and net balance for the financial year.
3. THE Ledger_Service SHALL return entries ordered by transaction_date ascending, then by created_at ascending.
4. THE Ledger_Service SHALL scope the query to the requesting user's center_id.

### Requirement 7: Balance Sheet Query by Custom Date Range

**User Story:** As a head coach, I want to view the ledger for a custom date range, so that I can analyze finances for any arbitrary period.

#### Acceptance Criteria

1. WHEN a GET request is made to the Balance_Sheet_API with from_date and to_date parameters (format: YYYY-MM-DD), THE Ledger_Service SHALL return all Ledger_Entries with transaction_date between from_date and to_date inclusive.
2. IF from_date is after to_date, THEN THE Ledger_Service SHALL return a 400 error with a descriptive message.
3. THE Ledger_Service SHALL return the total credits, total debits, and net balance for the filtered range.
4. THE Ledger_Service SHALL scope the query to the requesting user's center_id.

### Requirement 8: Balance Sheet Filter by Student

**User Story:** As a head coach, I want to filter the ledger by a specific student, so that I can see all fee payments made by that student.

#### Acceptance Criteria

1. WHEN a GET request is made to the Balance_Sheet_API with a student_id parameter, THE Ledger_Service SHALL return only Credit Ledger_Entries where person_id matches the student_id.
2. THE Ledger_Service SHALL allow combining the student_id filter with any time-period filter (month, quarter, financial year, or custom date range).
3. THE Ledger_Service SHALL return the total credits for the filtered student and period.
4. THE Ledger_Service SHALL scope the query to the requesting user's center_id.

### Requirement 9: Balance Sheet Filter by Coach

**User Story:** As a head coach, I want to filter the ledger by a specific coach, so that I can see all salary payments made to that coach.

#### Acceptance Criteria

1. WHEN a GET request is made to the Balance_Sheet_API with a coach_id parameter, THE Ledger_Service SHALL return only Debit Ledger_Entries where person_id matches the coach_id.
2. THE Ledger_Service SHALL allow combining the coach_id filter with any time-period filter (month, quarter, financial year, or custom date range).
3. THE Ledger_Service SHALL return the total debits for the filtered coach and period.
4. THE Ledger_Service SHALL scope the query to the requesting user's center_id.

### Requirement 10: Running Balance Calculation

**User Story:** As a head coach, I want to see a running balance alongside ledger entries, so that I can understand the cumulative financial position at any point.

#### Acceptance Criteria

1. WHEN the Balance_Sheet_API returns ledger entries, THE Ledger_Service SHALL include a running_balance field on each entry representing the cumulative net (credits minus debits) up to and including that entry.
2. THE Ledger_Service SHALL compute the running balance across all entries in chronological order within the filtered result set.
3. THE Ledger_Service SHALL include an opening_balance field in the response representing the net balance of all entries prior to the filtered period start date.

### Requirement 11: Access Control for Ledger

**User Story:** As a head coach, I want only authorized users to access the financial ledger, so that sensitive financial data is protected.

#### Acceptance Criteria

1. THE Ledger_Service SHALL restrict Balance_Sheet_API access to users with HEAD_COACH role or users with the can_access_fees permission on their center membership.
2. IF a user without the required role or permission attempts to access the Balance_Sheet_API, THEN THE Ledger_Service SHALL return a 403 error.
3. THE Ledger_Service SHALL restrict ledger operations to the user's own center to maintain multi-tenant isolation.

### Requirement 12: Ledger Entry Reversal on Payment Cancellation

**User Story:** As a head coach, I want the ledger to reflect corrections when a payment status is reverted, so that the financial record remains accurate.

#### Acceptance Criteria

1. WHEN a Fee_Record status is changed from PAID back to PENDING or OVERDUE, THE Ledger_Service SHALL create a reversal Debit Ledger_Entry with the same amount and a description indicating reversal.
2. WHEN a Salary_Record status is changed from PAID back to PENDING, THE Ledger_Service SHALL create a reversal Credit Ledger_Entry with the same amount and a description indicating reversal.
3. THE Ledger_Service SHALL link the reversal entry to the original entry via the reference_id field.
4. THE Ledger_Service SHALL use the current date as the transaction_date for reversal entries.

### Requirement 13: Manual Ledger Entry (Miscellaneous Income/Expense)

**User Story:** As a head coach, I want to manually add income or expense entries to the ledger for items not covered by regular fees or salaries, so that I can track extra class charges, coach bonuses, equipment purchases, facility maintenance, and other miscellaneous transactions.

#### Acceptance Criteria

1. THE Ledger_Service SHALL provide an API endpoint `POST /api/ledger/entries` that allows creating manual Ledger_Entries with entry_type CREDIT or DEBIT.
2. THE manual entry endpoint SHALL accept: entry_type (CREDIT or DEBIT), amount (positive number), transaction_date, description (required, free text), and optionally a category field.
3. THE manual Ledger_Entry SHALL have reference_type set to MANUAL to distinguish it from auto-generated FEE or SALARY entries.
4. THE manual entry endpoint SHALL NOT require a person_id — it can optionally be associated with a student or coach.
5. WHEN category is provided, THE Ledger_Service SHALL store it on the entry (common categories: "Extra Classes", "Coach Bonus", "Equipment", "Facility", "Tournament", "Miscellaneous").
6. THE manual entry endpoint SHALL be restricted to users with HEAD_COACH role or can_access_fees permission.
7. THE Balance_Sheet_API SHALL include manual entries in all query results alongside automated FEE and SALARY entries.
