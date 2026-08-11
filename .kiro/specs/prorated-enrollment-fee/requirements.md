# Requirements Document

## Introduction

When a student is enrolled into a batch that has a linked batch time template, the system automatically calculates a prorated fee for the remaining sessions in the current month and creates a pending fee record on the student's account. This ensures students are only charged for the classes they can actually attend from their enrollment date onward.

## Glossary

- **Enrollment_Service**: The backend service responsible for creating student records and triggering post-enrollment actions via POST /api/students
- **Proration_Calculator**: The component that computes the prorated fee amount based on remaining sessions in the current month
- **Session_Slot**: A scheduled training session within a batch time template, defined by a day of week, start time, and duration
- **Batch_Time_Template**: A reusable weekly schedule pattern consisting of one or more Session_Slots assigned to a batch
- **Fee_Record**: A database entry in fee_records representing an amount owed or paid by a student for a given month
- **Monthly_Fee**: The per-student fee amount captured during enrollment that represents the full monthly charge
- **Remaining_Sessions**: The count of session slots that fall on dates after the enrollment date within the current calendar month
- **Total_Monthly_Sessions**: The total count of session slot occurrences within the full current calendar month based on the template schedule
- **Prorated_Amount**: The calculated fee equal to (Monthly_Fee / Total_Monthly_Sessions) × Remaining_Sessions, rounded to two decimal places

## Requirements

### Requirement 1: Accept Monthly Fee During Enrollment

**User Story:** As a head coach, I want to specify a student's monthly fee during enrollment, so that the system can calculate prorated charges automatically.

#### Acceptance Criteria

1. WHEN a student is created via POST /api/students with a monthlyFee field, THE Enrollment_Service SHALL store the Monthly_Fee value on the student record
2. THE Enrollment_Service SHALL accept monthlyFee as an optional numeric field with a minimum value of 0
3. IF monthlyFee is provided and is not a valid non-negative number, THEN THE Enrollment_Service SHALL return a 400 error with a descriptive message

### Requirement 2: Calculate Remaining Sessions in Current Month

**User Story:** As a head coach, I want the system to determine how many sessions remain in the current month after a student's enrollment date, so that the prorated fee reflects actual available classes.

#### Acceptance Criteria

1. WHEN a student is enrolled with a batchId and monthlyFee, THE Proration_Calculator SHALL retrieve the Batch_Time_Template linked to the batch via template_id
2. WHEN the Batch_Time_Template is retrieved, THE Proration_Calculator SHALL count all Session_Slot occurrences that fall on dates strictly after the enrollment date within the current calendar month as Remaining_Sessions
3. WHEN the Batch_Time_Template is retrieved, THE Proration_Calculator SHALL count all Session_Slot occurrences within the full current calendar month as Total_Monthly_Sessions
4. THE Proration_Calculator SHALL map session_slot day_of_week values (Mon, Tue, Wed, Thu, Fri, Sat, Sun) to the corresponding calendar dates within the current month

### Requirement 3: Compute Prorated Fee Amount

**User Story:** As a head coach, I want the system to calculate a fair prorated fee based on remaining sessions, so that new students pay only for classes they can attend.

#### Acceptance Criteria

1. WHEN Remaining_Sessions and Total_Monthly_Sessions are calculated, THE Proration_Calculator SHALL compute Prorated_Amount as (Monthly_Fee / Total_Monthly_Sessions) × Remaining_Sessions
2. THE Proration_Calculator SHALL round the Prorated_Amount to two decimal places using standard rounding rules
3. IF Total_Monthly_Sessions is zero, THEN THE Proration_Calculator SHALL set Prorated_Amount to zero
4. IF Remaining_Sessions equals zero, THEN THE Proration_Calculator SHALL set Prorated_Amount to zero

### Requirement 4: Create Pending Fee Record on Enrollment

**User Story:** As a head coach, I want the system to automatically create a pending fee entry when a student is enrolled mid-month, so that the student's account reflects the prorated amount owed.

#### Acceptance Criteria

1. WHEN a student is successfully created with a batchId, monthlyFee, and a valid linked Batch_Time_Template, THE Enrollment_Service SHALL create a Fee_Record with the Prorated_Amount
2. THE Enrollment_Service SHALL set the Fee_Record status to PENDING
3. THE Enrollment_Service SHALL set the Fee_Record month_year to the current month in YYYY-MM format
4. THE Enrollment_Service SHALL set the Fee_Record due_date to the last day of the current month
5. THE Enrollment_Service SHALL set the Fee_Record notes to indicate it is a prorated enrollment fee (e.g., "Prorated fee: X of Y sessions remaining")
6. THE Enrollment_Service SHALL associate the Fee_Record with the student's center_id for tenant scoping

### Requirement 5: Skip Proration When Conditions Are Not Met

**User Story:** As a head coach, I want enrollment to succeed without creating a prorated fee when required data is missing, so that the enrollment flow is not blocked by optional fee logic.

#### Acceptance Criteria

1. IF the student is created without a batchId, THEN THE Enrollment_Service SHALL skip prorated fee creation and complete enrollment normally
2. IF the student is created without a monthlyFee, THEN THE Enrollment_Service SHALL skip prorated fee creation and complete enrollment normally
3. IF the assigned batch has no linked Batch_Time_Template (template_id is null), THEN THE Enrollment_Service SHALL skip prorated fee creation and complete enrollment normally
4. IF the Prorated_Amount is zero, THEN THE Enrollment_Service SHALL skip Fee_Record creation

### Requirement 6: Non-Blocking Fee Calculation

**User Story:** As a head coach, I want enrollment to succeed even if the prorated fee calculation encounters an error, so that student creation is never blocked by fee logic failures.

#### Acceptance Criteria

1. THE Enrollment_Service SHALL execute prorated fee calculation asynchronously after the student record is persisted and the success response is returned
2. IF the prorated fee calculation encounters a database error or unexpected exception, THEN THE Enrollment_Service SHALL log the error and continue without affecting the enrollment response
3. THE Enrollment_Service SHALL return the created student record in the response before initiating prorated fee calculation
