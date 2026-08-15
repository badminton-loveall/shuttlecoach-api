# Requirements Document

## Introduction

The Batch Setup Wizard consolidates the scattered batch creation and editing experience (currently spread across Settings → Templates, Batches → Add/Edit modal, and Coach assignment) into a single guided stepper wizard. The wizard lives under the Training menu and walks the user through five sequential steps: Batch Info, Schedule, Curriculum, Assign Coach, and Review & Create. The same wizard handles both creation and editing (pre-populated).

## Glossary

- **Wizard**: A full-page multi-step form (stepper) that guides the user through batch setup sequentially
- **Stepper**: The visual progress indicator showing the five numbered steps and current position
- **Batch**: A group training slot with a name, skill level, capacity, schedule, curriculum, and assigned coach
- **Batch_Time_Template**: A reusable schedule definition specifying which days of the week and time slots the batch meets
- **Curriculum**: A course/training plan that can be attached to a batch
- **Coach**: A HEAD_COACH or ASSISTANT_COACH user who runs a batch
- **Training_Menu**: The primary navigation section containing Batches, Drills, and Courses
- **Batch_List_Page**: The page at /batches that shows all batches with options to create or edit

## Requirements

### Requirement 1: Wizard Navigation and Stepper

**User Story:** As a head coach, I want a guided stepper wizard for batch setup, so that I can complete all batch configuration in one continuous flow instead of jumping between multiple pages.

#### Acceptance Criteria

1. WHEN the user clicks "Add Batch" on the Batch_List_Page, THE Wizard SHALL navigate to a full-page stepper view with four steps labeled: Batch Timing Template, Curriculum Preparation, Assign Coach, and Batch Details
2. THE Stepper SHALL display all four step labels as tab headings at the top of the wizard with the current step visually highlighted
3. WHEN the user clicks "Next" on a completed step, THE Wizard SHALL advance to the next step
4. WHEN the user clicks "Back" on any step after Step 1, THE Wizard SHALL return to the previous step preserving all entered data
5. WHEN the user clicks a previously completed step tab heading, THE Wizard SHALL navigate directly to that step
6. THE Wizard SHALL prevent forward navigation to a step unless all preceding required steps are valid
7. WHEN the user clicks "Cancel" at any step, THE Wizard SHALL prompt for confirmation and return to the Batch_List_Page discarding unsaved data

### Requirement 2: Step 1 — Batch Timing Template

**User Story:** As a head coach, I want to create or select a batch timing template as the first step, so that the batch schedule is defined before anything else.

#### Acceptance Criteria

1. THE Wizard SHALL display a list of existing Batch_Time_Templates to select from in Step 1
2. WHEN no existing template fits, THE Wizard SHALL allow the user to create a new Batch_Time_Template inline without leaving the wizard
3. WHEN creating a new template, THE Wizard SHALL require a template name, at least one day of the week, a start time, and a duration selected from: 1, 1.5, 2, 2.5, 3, 3.5, or 4 hours
4. WHEN a template is selected or created, THE Wizard SHALL display the selected schedule summary (days and time)
5. THE Wizard SHALL require a template selection before allowing navigation to Step 2

### Requirement 3: Step 2 — Curriculum Preparation

**User Story:** As a head coach, I want to attach or create a curriculum in the second step, so that the batch has structured training content.

#### Acceptance Criteria

1. THE Wizard SHALL display a list of existing Curricula (courses) to select from in Step 2
2. WHEN no existing curriculum fits, THE Wizard SHALL allow the user to create a new curriculum inline without leaving the wizard
3. WHEN a curriculum is selected, THE Wizard SHALL display the curriculum name and week count as a summary
4. THE Wizard SHALL allow proceeding to Step 3 without selecting a curriculum (curriculum is optional)

### Requirement 4: Step 3 — Assign Coach

**User Story:** As a head coach, I want to assign a coach to the batch in the third step, so that someone is responsible for running the sessions.

#### Acceptance Criteria

1. THE Wizard SHALL display a list of available coaches (HEAD_COACH and ASSISTANT_COACH) to select from in Step 3
2. THE Wizard SHALL display each coach's name and role in the selection list
3. THE Wizard SHALL allow proceeding to Step 4 without assigning a coach (coach assignment is optional)
4. WHEN a coach is selected, THE Wizard SHALL display the selected coach's name as confirmation

### Requirement 5: Step 4 — Batch Details

**User Story:** As a head coach, I want to set the batch name, skill level, and capacity in the final step along with a review summary, so that I can name the batch and confirm all settings before saving.

#### Acceptance Criteria

1. THE Wizard SHALL display input fields for batch name, skill level, and capacity in Step 4
2. THE Wizard SHALL require the batch name field to be non-empty before allowing submission
3. THE Wizard SHALL provide skill level as a selectable dropdown with options: Beginner, Intermediate, Advanced, and Professional
4. THE Wizard SHALL accept capacity as a positive integer
5. THE Wizard SHALL display a read-only summary of Steps 1–3 selections above the input fields in Step 4
6. THE Wizard SHALL NOT display any fee-related fields
7. WHEN the user clicks "Create Batch" in Step 4, THE Wizard SHALL submit the batch data to the API via POST /api/batches
8. WHEN the API responds with success, THE Wizard SHALL navigate to the Batch_List_Page and display a success notification
9. IF the API responds with an error, THEN THE Wizard SHALL display the error message and remain on Step 4

### Requirement 6: Edit Mode

**User Story:** As a head coach, I want to edit an existing batch using the same wizard, so that modification uses the same guided flow as creation.

#### Acceptance Criteria

1. WHEN the user clicks "Edit" on a batch in the Batch_List_Page, THE Wizard SHALL open with all four steps pre-populated with the existing batch data
2. WHILE in edit mode, THE Stepper SHALL display "Edit Batch" as the page title instead of "Create Batch"
3. WHILE in edit mode, THE Step 4 button SHALL display "Save Changes" instead of "Create Batch"
4. WHEN the user clicks "Save Changes" in edit mode, THE Wizard SHALL submit the updated data to the API via PATCH /api/batches/:id
5. WHEN the API responds with success after editing, THE Wizard SHALL navigate to the Batch_List_Page and display a success notification

### Requirement 8: Navigation Simplification

**User Story:** As a head coach, I want a simplified navigation with only essential items, so that the interface is clean and I can find everything quickly.

#### Acceptance Criteria

1. THE Primary_Navigation SHALL contain exactly four top-level items: Dashboard, Batches, Students, and Finance
2. THE "Batches" nav item SHALL navigate directly to the Batch_List_Page (no dropdown submenu)
3. THE "Students" nav item SHALL navigate to the Students list page
4. THE "Finance" nav item SHALL provide access to Fees, Ledger, and related financial pages
5. THE Training dropdown menu SHALL be removed from the navigation
6. THE "Courses" menu item SHALL be removed since curriculum is managed within the batch wizard
7. THE "Drills" page SHALL be accessible from within the Batch wizard curriculum step or from a secondary link on the Batch_List_Page
8. THE "Calendar" and "Attendance" pages SHALL be accessible from the Dashboard (contextual links)
9. THE "Analytics" page SHALL be accessible from a secondary link within the Dashboard or batch detail view
10. THE Settings page SHALL no longer display the Templates tab for batch time templates

### Requirement 7: Access Control

**User Story:** As an assistant coach, I want to view batch details in read-only mode, so that I can see the training schedule without accidentally modifying it.

#### Acceptance Criteria

1. WHILE the user role is HEAD_COACH, THE Wizard SHALL allow full create and edit functionality
2. WHILE the user role is ASSISTANT_COACH, THE Batch_List_Page SHALL display batch details in read-only mode
3. WHILE the user role is ASSISTANT_COACH, THE Batch_List_Page SHALL NOT display "Add Batch" or "Edit" action buttons

### Requirement 8: Student and Fee Exclusion

**User Story:** As a head coach, I want batch setup to be independent of student assignment and fee configuration, so that those concerns remain managed on their respective pages.

#### Acceptance Criteria

1. THE Wizard SHALL NOT include any student assignment functionality in any step
2. THE Wizard SHALL NOT include any fee input or fee display in any step
3. THE Batch data model SHALL NOT store fee information at the batch level
