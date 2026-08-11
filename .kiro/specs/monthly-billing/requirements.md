# Requirements Document

## Introduction

This feature automates the billing lifecycle for ShuttleCoach. It covers two scenarios: (A) calculating a prorated fee when a student enrolls mid-month and is assigned to a batch, and (B) generating recurring monthly invoices on the 1st of each month for all active students (fee receivable) and all active coaches (salary payable). The system uses the batch's linked time template (session slots with days of the week) to determine session counts for proration.

## Glossary

- **Billing_Service**: The backend service responsible for creating, calculating, and managing fee records and salary payable entries.
- **Scheduler**: The cron/scheduled job subsystem that triggers recurring tasks on a defined schedule.
- **Fee_Record**: An entry in the `fee_records` table representing a receivable amount owed by a student for a billing period.
- **Salary_Record**: An entry representing a payable amount owed to a coach for a billing period.
- **Batch**: A training group with a defined schedule (via template), assigned coach, and monthly fee.
- **Session_Slot**: A record in `session_slots` defining a day of the week and time when a batch session occurs.
- **Batch_Time_Template**: A template linked to a batch that contains one or more Session_Slots defining recurring session days.
- **Monthly_Fee**: The full monthly fee amount defined on a batch, representing the cost for a complete month of sessions.
- **Prorated_Fee**: A fee amount calculated as a proportion of the Monthly_Fee based on remaining sessions in the current month.
- **Active_Student**: A student whose status is not `archived` and who is assigned to a non-archived batch.
- **Active_Coach**: A user with role `HEAD_COACH` or `ASSISTANT_COACH` whose account is not deactivated.
- **Center**: A multi-tenant unit (academy/club) that scopes all billing operations.

## Requirements

### Requirement 1: Prorated Fee Calculation on Mid-Month Enrollment

**User Story:** As a head coach, I want the system to automatically calculate a prorated fee when I enroll a student mid-month and assign them to a batch, so that the student is only charged for the remaining sessions in the current month.

#### Acceptance Criteria

1. WHEN a student is assigned to a batch that has a linked Batch_Time_Template, THE Billing_Service SHALL calculate the number of remaining sessions in the current month from the assignment date (inclusive) to the end of the month.
2. WHEN the remaining session count is calculated, THE Billing_Service SHALL compute the Prorated_Fee as: `(Monthly_Fee / total_sessions_in_month) * remaining_sessions`.
3. WHEN the Prorated_Fee is computed, THE Billing_Service SHALL create a Fee_Record with status PENDING, the prorated amount, the current month-year as the billing period, and a due date of 7 days from the assignment date.
4. IF the batch does not have a linked Batch_Time_Template, THEN THE Billing_Service SHALL skip prorated fee creation and log a warning.
5. IF the batch Monthly_Fee is null or zero, THEN THE Billing_Service SHALL skip prorated fee creation.
6. WHEN a student is assigned to a batch on the 1st of the month, THE Billing_Service SHALL create a full Monthly_Fee record instead of a prorated one.

### Requirement 2: Monthly Student Invoice Generation

**User Story:** As an academy owner, I want invoices to be automatically generated on the 1st of every month for all active students, so that I have consistent receivable tracking without manual entry.

#### Acceptance Criteria

1. WHEN the Scheduler triggers on the 1st of each month, THE Billing_Service SHALL generate a Fee_Record for every Active_Student who is assigned to a batch with a non-null Monthly_Fee.
2. THE Billing_Service SHALL set the Fee_Record amount to the batch's Monthly_Fee value.
3. THE Billing_Service SHALL set the Fee_Record month_year to the current month (format: YYYY-MM).
4. THE Billing_Service SHALL set the Fee_Record due_date to the 10th of the current month.
5. THE Billing_Service SHALL set the Fee_Record status to PENDING.
6. IF a Fee_Record already exists for a student for the current month_year, THEN THE Billing_Service SHALL skip creation for that student to prevent duplicates.
7. THE Billing_Service SHALL scope all operations to the student's Center to maintain multi-tenant isolation.

### Requirement 3: Monthly Coach Salary Payable Generation

**User Story:** As an academy owner, I want salary payable entries to be automatically generated on the 1st of every month for all active coaches, so that I can track coaching expenses alongside student receivables.

#### Acceptance Criteria

1. WHEN the Scheduler triggers on the 1st of each month, THE Billing_Service SHALL generate a Salary_Record for every Active_Coach who has a non-null salary amount.
2. THE Billing_Service SHALL set the Salary_Record amount to the coach's defined monthly salary.
3. THE Billing_Service SHALL set the Salary_Record month_year to the current month (format: YYYY-MM).
4. THE Billing_Service SHALL set the Salary_Record status to PENDING.
5. IF a Salary_Record already exists for a coach for the current month_year, THEN THE Billing_Service SHALL skip creation for that coach to prevent duplicates.
6. THE Billing_Service SHALL scope all operations to the coach's Center to maintain multi-tenant isolation.

### Requirement 4: Coach Salary Field

**User Story:** As a head coach, I want to define a monthly salary for each coach, so that the system can generate salary payable entries automatically.

#### Acceptance Criteria

1. THE Billing_Service SHALL support a `monthly_salary` field (numeric, nullable) on the coach (users) record.
2. WHEN a coach is created or updated, THE Billing_Service SHALL accept and persist the monthly_salary value.
3. IF the monthly_salary field is null, THEN THE Billing_Service SHALL exclude the coach from monthly salary generation.

### Requirement 5: Scheduler Configuration

**User Story:** As a system administrator, I want the monthly billing job to run reliably on the 1st of every month, so that invoices and salary entries are generated without manual intervention.

#### Acceptance Criteria

1. THE Scheduler SHALL execute the monthly billing job at 00:05 UTC on the 1st of every month.
2. WHEN the Scheduler triggers, THE Billing_Service SHALL process all Centers sequentially to maintain tenant isolation.
3. IF the monthly billing job fails for a Center, THEN THE Billing_Service SHALL log the error and continue processing the remaining Centers.
4. WHEN the monthly billing job completes, THE Billing_Service SHALL log a summary including the count of Fee_Records created, Salary_Records created, and any errors encountered.

### Requirement 6: Billing API Endpoints

**User Story:** As a head coach, I want API endpoints to manually trigger prorated fee creation and view billing summaries, so that I can handle edge cases and verify automated billing.

#### Acceptance Criteria

1. WHEN a POST request is made to the prorated fee endpoint with a student ID, THE Billing_Service SHALL calculate and create a prorated Fee_Record for the current month.
2. WHEN a POST request is made to the monthly billing trigger endpoint, THE Billing_Service SHALL execute the monthly billing job for the requesting user's Center.
3. THE Billing_Service SHALL restrict the manual trigger endpoint to HEAD_COACH role only.
4. WHEN a GET request is made to the billing summary endpoint with a month_year parameter, THE Billing_Service SHALL return the count and total amount of Fee_Records and Salary_Records for the specified month.
