# Requirements Document

## Introduction

This feature transforms the "Add Assistant Coach" form into a unified "Add Coach" form with an optional senior coach selection. The coach hierarchy is determined by whether a senior coach is selected: if no senior coach is chosen, the new coach becomes a top-level head coach with full authority; if a senior coach is selected, the new coach becomes an assistant coach reporting to that senior. This applies to both the frontend modal and the backend API endpoint.

## Glossary

- **Coach_Form**: The modal dialog used to create a new coach account in the Coach Management page
- **Senior_Coach_Dropdown**: An optional dropdown field in the Coach_Form that lists existing coaches at the center
- **API_Endpoint**: The POST /api/coaches backend endpoint that creates coach accounts
- **Coach_Management_Page**: The frontend page displaying the list of coaches and the button to add new coaches
- **Welcome_Email_Service**: The existing service that sends welcome emails to newly created coaches

## Requirements

### Requirement 1: Unified Coach Creation Form

**User Story:** As a head coach, I want a single "Add Coach" form instead of "Add Assistant Coach", so that I can create coaches of any level from one place.

#### Acceptance Criteria

1. THE Coach_Form SHALL display the title "Add Coach" and the subtitle "Create a new coach account" instead of "Add Assistant Coach" and "Create a new assistant coach account"
2. THE Coach_Management_Page SHALL display the button label "+ Add Coach" instead of "+ Add Assistant Coach"
3. THE Coach_Form SHALL include a Senior_Coach_Dropdown field labeled "Senior Coach" with an "(optional)" indicator, positioned after the Profile Photo URL field and before the form action buttons
4. WHILE the Coach_Form is in a submitting state, THE Senior_Coach_Dropdown SHALL be disabled to prevent changes during submission

### Requirement 2: Senior Coach Selection

**User Story:** As a head coach, I want to optionally select a senior coach when creating a new coach, so that I can establish the coaching hierarchy.

#### Acceptance Criteria

1. THE Senior_Coach_Dropdown SHALL list all existing coaches (HEAD_COACH and ASSISTANT_COACH roles) at the current center, sorted alphabetically by full name
2. THE Senior_Coach_Dropdown SHALL allow selecting no value (empty selection) to indicate a top-level coach
3. THE Senior_Coach_Dropdown SHALL display each coach's full name as the option label
4. THE Senior_Coach_Dropdown SHALL be displayed without a required-field indicator to denote that selection is optional
5. IF no existing coaches are present at the current center, THEN THE Senior_Coach_Dropdown SHALL render as an empty dropdown with no selectable coach options

### Requirement 3: Role Assignment Based on Senior Coach Selection

**User Story:** As a head coach, I want the system to automatically assign the correct role based on the senior coach selection, so that the hierarchy permissions are correctly applied.

#### Acceptance Criteria

1. WHEN the `seniorCoachId` field is absent or null in the coach creation request, THE API_Endpoint SHALL assign the HEAD_COACH role to the new coach and store `senior_coach_id` as NULL on the new coach record
2. WHEN a valid `seniorCoachId` is provided in the coach creation request, THE API_Endpoint SHALL assign the ASSISTANT_COACH role to the new coach
3. WHEN a valid `seniorCoachId` is provided in the coach creation request, THE API_Endpoint SHALL store the provided senior coach ID in the `senior_coach_id` field on the new coach record
4. THE API_Endpoint SHALL include the assigned role and the `seniorCoachId` value (or null) in the creation response payload

### Requirement 4: API Endpoint Update

**User Story:** As a developer, I want the POST /api/coaches endpoint to accept an optional seniorCoachId parameter, so that the backend can determine the coach role and hierarchy.

#### Acceptance Criteria

1. THE API_Endpoint SHALL accept an optional `seniorCoachId` field in the request body, where a null value or absent field indicates no senior coach is assigned
2. WHEN `seniorCoachId` is provided, THE API_Endpoint SHALL validate that the referenced ID belongs to an existing user with role HEAD_COACH or ASSISTANT_COACH in the same center as the requesting user
3. IF `seniorCoachId` is provided but is not a valid UUID, THEN THE API_Endpoint SHALL return a 400 error with a message indicating the ID format is invalid
4. IF `seniorCoachId` references a user that does not exist, does not have a coach role (HEAD_COACH or ASSISTANT_COACH), or belongs to a different center, THEN THE API_Endpoint SHALL return a 400 error with a message indicating the senior coach reference is invalid
5. WHEN a coach is successfully created, THE API_Endpoint SHALL include the `seniorCoachId` value (or null if not provided) in the 201 response payload

### Requirement 5: Database Schema Update

**User Story:** As a developer, I want a `senior_coach_id` column on the users table, so that the coaching hierarchy is persisted.

#### Acceptance Criteria

1. THE users table SHALL have a nullable `senior_coach_id` column of type UUID referencing the users table with a self-referential foreign key
2. WHEN a user record is deleted, THE users table SHALL set `senior_coach_id` to NULL on any coach that referenced the deleted user (ON DELETE SET NULL)
3. THE database SHALL have an index on the `senior_coach_id` column for query performance
4. THE `senior_coach_id` column SHALL NOT allow a user to reference their own ID (no self-referencing)

### Requirement 6: Welcome Email Continuity

**User Story:** As a head coach, I want newly created coaches to receive a welcome email regardless of their role, so that all coaches get their login credentials.

#### Acceptance Criteria

1. WHEN a coach is created with an email address and no senior coach selected, THE Welcome_Email_Service SHALL send a welcome email to the new head coach
2. WHEN a coach is created with an email address and a senior coach selected, THE Welcome_Email_Service SHALL send a welcome email to the new assistant coach
3. WHEN a coach is created without an email address, THE Welcome_Email_Service SHALL not attempt to send an email regardless of role assignment
