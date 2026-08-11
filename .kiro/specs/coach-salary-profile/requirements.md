# Requirements Document

## Introduction

This feature enhances the coach profile to mirror the detailed student enrollment form, adds a monthly salary configuration field to each coach's profile, and introduces automatic monthly salary record generation. The system creates PENDING salary records at month-end for all coaches with a configured monthly salary, which can then be marked as PAID to trigger DEBIT ledger entries via the existing ledger integration.

## Glossary

- **Coach_Profile_Service**: The backend service responsible for creating, updating, and retrieving coach profiles with extended detail fields.
- **Salary_Generator**: The service responsible for auto-generating monthly salary records for coaches who have a configured monthly_salary.
- **Salary_Record**: A database row representing a single month's salary owed to or paid to a coach, with fields: id, coach_user_id, amount, salary_period, status, payment_date, payment_method, center_id, created_at.
- **Coach**: A user with role HEAD_COACH or ASSISTANT_COACH in the users table.
- **Monthly_Salary**: A numeric field (INR) on the coach profile representing the configured recurring salary amount.
- **Salary_Period**: A string in YYYY-MM format identifying the calendar month a Salary_Record applies to.
- **Center**: The multi-tenant unit (academy/club) that scopes all coach and salary operations.
- **Head_Coach**: A user with HEAD_COACH role who has administrative access to manage coaches and salary operations.

## Requirements

### Requirement 1: Extended Coach Profile Fields

**User Story:** As a head coach, I want to store detailed profile information for each coach (phone, date of birth, address, qualification, experience, bank details), so that I have complete records similar to student profiles.

#### Acceptance Criteria

1. THE Coach_Profile_Service SHALL support storing the following additional fields on a coach profile: phone (varchar, optional), date_of_birth (date, optional), address (text, optional), qualification (text, optional), experience_years (integer, optional), bank_details (text, optional, encrypted or free-text for account info), and monthly_salary (numeric with two decimal places, optional).
2. WHEN a new coach is created via the POST /api/coaches endpoint, THE Coach_Profile_Service SHALL accept and persist all extended profile fields alongside existing fields (name, username, password, email, specialization, profilePhoto, seniorCoachId).
3. WHEN a coach profile is updated via the PATCH /api/coaches/:id endpoint, THE Coach_Profile_Service SHALL accept and update any combination of the extended profile fields.
4. THE Coach_Profile_Service SHALL return all extended profile fields in the response of create, update, and get coach API calls.
5. THE Coach_Profile_Service SHALL allow the monthly_salary field to be set to null to indicate no salary is configured for that coach.

### Requirement 2: Coach Profile Retrieval with Full Details

**User Story:** As a head coach, I want to retrieve a single coach's full profile including all extended fields, so that I can view and manage their complete information on a details page.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/coaches/:id, THE Coach_Profile_Service SHALL return the complete coach profile including all base fields (id, username, role, name, email, profile_photo, specialization, senior_coach_id) and all extended fields (phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary).
2. THE Coach_Profile_Service SHALL scope the query to the requesting user's center_id for tenant isolation.
3. IF the requested coach ID does not exist within the user's center, THEN THE Coach_Profile_Service SHALL return a 404 error.

### Requirement 3: Monthly Salary Configuration

**User Story:** As a head coach, I want to set and update the monthly salary amount on a coach's profile, so that the system knows how much to generate in salary records each month.

#### Acceptance Criteria

1. WHEN the monthly_salary field is included in a PATCH /api/coaches/:id request, THE Coach_Profile_Service SHALL validate that the value is a positive number or null.
2. IF monthly_salary is set to a non-positive number, THEN THE Coach_Profile_Service SHALL return a 400 error with a descriptive message.
3. THE Coach_Profile_Service SHALL restrict monthly_salary updates to users with HEAD_COACH role.
4. WHEN monthly_salary is updated, THE Coach_Profile_Service SHALL use the new value for subsequent salary record generation without affecting previously generated Salary_Records.

### Requirement 4: Salary Records Table Creation

**User Story:** As a developer, I want a salary_records table created with the correct schema, so that the system can store and manage monthly salary records for coaches.

#### Acceptance Criteria

1. THE Coach_Profile_Service SHALL require a salary_records table with columns: id (UUID, primary key), coach_user_id (UUID, foreign key to users.id, not null), amount (numeric 10,2, not null), salary_period (varchar 7 in YYYY-MM format, not null), status (varchar, default PENDING), payment_date (date, nullable), payment_method (varchar, nullable), center_id (UUID, foreign key to centers.id, not null), and created_at (timestamp, default now).
2. THE salary_records table SHALL have a unique constraint on (coach_user_id, salary_period) to prevent duplicate records for the same coach and month.
3. THE salary_records table SHALL have indexes on coach_user_id, center_id, salary_period, and status for efficient querying.

### Requirement 5: Monthly Salary Record Auto-Generation

**User Story:** As a head coach, I want the system to automatically generate PENDING salary records at month end for each coach with a configured salary, so that I don't have to manually create salary entries every month.

#### Acceptance Criteria

1. WHEN the Salary_Generator is triggered (via a manual button or scheduled cron at month end), THE Salary_Generator SHALL create a Salary_Record with status PENDING for each Coach in the center who has a non-null monthly_salary value.
2. THE Salary_Generator SHALL set the amount on each generated Salary_Record to the coach's current monthly_salary value at the time of generation.
3. THE Salary_Generator SHALL set the salary_period to the month being closed (format: YYYY-MM).
4. THE Salary_Generator SHALL set the center_id on each Salary_Record to match the coach's center_id.
5. IF a Salary_Record already exists for a coach for the given salary_period, THEN THE Salary_Generator SHALL skip that coach to prevent duplicate records.
6. THE Salary_Generator SHALL return a summary indicating how many records were created and how many were skipped.

### Requirement 6: Salary Generation Trigger via API

**User Story:** As a head coach, I want to trigger salary generation manually via a button, so that I can control when monthly salary records are created in case the automatic process missed or I need to generate mid-cycle.

#### Acceptance Criteria

1. WHEN a POST request is made to /api/salary/generate with a period parameter (format: YYYY-MM), THE Salary_Generator SHALL generate Salary_Records for all eligible coaches in the requesting user's center.
2. THE Salary_Generator SHALL restrict the generate endpoint to users with HEAD_COACH role.
3. IF the period parameter is missing or not in YYYY-MM format, THEN THE Salary_Generator SHALL return a 400 error with a descriptive message.
4. THE Salary_Generator SHALL scope all operations to the requesting user's center_id.

### Requirement 7: List Salary Records

**User Story:** As a head coach, I want to view all salary records for a given period, so that I can see which salaries are pending and which have been paid.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/salary with an optional period parameter (YYYY-MM), THE Coach_Profile_Service SHALL return all Salary_Records for the specified period within the user's center.
2. WHEN no period parameter is provided, THE Coach_Profile_Service SHALL return Salary_Records for the current month.
3. THE Coach_Profile_Service SHALL include coach name and profile details alongside each Salary_Record in the response.
4. THE Coach_Profile_Service SHALL order results by coach name ascending.
5. THE Coach_Profile_Service SHALL scope the query to the requesting user's center_id.

### Requirement 8: Get Salary Records for a Specific Coach

**User Story:** As a head coach, I want to view the salary history for a specific coach, so that I can review their payment records over time.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/salary/coach/:coachId, THE Coach_Profile_Service SHALL return all Salary_Records for the specified coach within the user's center, ordered by salary_period descending.
2. THE Coach_Profile_Service SHALL allow an optional period query parameter to filter to a specific month.
3. IF the specified coach does not belong to the user's center, THEN THE Coach_Profile_Service SHALL return a 404 error.
4. THE Coach_Profile_Service SHALL scope the query to the requesting user's center_id.

### Requirement 9: Mark Salary as Paid (Existing Integration)

**User Story:** As a head coach, I want marking a salary as paid to create a DEBIT ledger entry, so that salary payments appear in the center's financial records.

#### Acceptance Criteria

1. WHEN a PATCH request is made to /api/salary/:id/pay with paymentDate and paymentMethod, THE Coach_Profile_Service SHALL update the Salary_Record status from PENDING to PAID.
2. THE Coach_Profile_Service SHALL store the payment_date and payment_method on the Salary_Record.
3. WHEN the Salary_Record status changes to PAID, THE Coach_Profile_Service SHALL trigger creation of a DEBIT Ledger_Entry via the existing ledger service integration.
4. IF the Salary_Record is already PAID, THEN THE Coach_Profile_Service SHALL return a 400 error indicating the salary is already marked as paid.
5. THE Coach_Profile_Service SHALL scope the operation to the requesting user's center_id.

### Requirement 10: Revert Salary Payment (Existing Integration)

**User Story:** As a head coach, I want to revert a paid salary back to pending status, so that I can correct mistakes in salary processing.

#### Acceptance Criteria

1. WHEN a PATCH request is made to /api/salary/:id/revert, THE Coach_Profile_Service SHALL update the Salary_Record status from PAID back to PENDING and clear payment_date and payment_method.
2. WHEN the Salary_Record status is reverted from PAID to PENDING, THE Coach_Profile_Service SHALL trigger creation of a reversal CREDIT Ledger_Entry via the existing ledger service integration.
3. IF the Salary_Record is not currently PAID, THEN THE Coach_Profile_Service SHALL return a 400 error indicating only paid salaries can be reverted.
4. THE Coach_Profile_Service SHALL scope the operation to the requesting user's center_id.

### Requirement 11: Access Control for Coach Profile and Salary Operations

**User Story:** As a head coach, I want only authorized users to manage coach profiles and salary operations, so that sensitive HR and financial data is protected.

#### Acceptance Criteria

1. THE Coach_Profile_Service SHALL restrict create, update, and salary-related operations on coach profiles to users with HEAD_COACH role.
2. THE Coach_Profile_Service SHALL allow coaches with ASSISTANT_COACH role to view their own profile details via GET /api/coaches/:id when the id matches their own user ID.
3. IF a user without HEAD_COACH role attempts to create, update, or manage salary for another coach, THEN THE Coach_Profile_Service SHALL return a 403 error.
4. THE Coach_Profile_Service SHALL enforce center-level tenant isolation on all coach profile and salary queries.

### Requirement 12: Users Table Migration for Extended Fields

**User Story:** As a developer, I want the users table extended with new columns for coach profile details, so that the backend can persist the additional information.

#### Acceptance Criteria

1. THE migration SHALL add the following columns to the users table: phone (varchar 20, nullable), date_of_birth (date, nullable), address (text, nullable), qualification (text, nullable), experience_years (integer, nullable), bank_details (text, nullable), monthly_salary (numeric 10,2, nullable).
2. THE migration SHALL be backward-compatible, adding only nullable columns so existing data remains valid.
3. THE migration SHALL not modify or remove any existing columns or constraints on the users table.
