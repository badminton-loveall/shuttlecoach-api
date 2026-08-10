# Requirements Document

## Introduction

This feature provides a single smart endpoint (`POST /api/admin/centers/:id/invite-head-coach`) that handles head coach invitation for a center. The endpoint accepts an email address and handles two cases: if the email does not match an existing user, it creates a new user account and sends a welcome email with a password reset link; if the email matches an existing user, it creates a new center membership and sends a notification email (no reset token needed since the user already has credentials). Multi-center access is managed via the `user_center_memberships` table — a user logs in once and sees all their centers. A separate endpoint allows re-sending a password reset link to an already-assigned head coach.

## Glossary

- **Admin**: A user with the SUPER_ADMIN role who manages centers via the admin panel.
- **Invite_Endpoint**: The API endpoint `POST /api/admin/centers/:id/invite-head-coach` that handles both new and existing user invitation flows.
- **Head_Coach**: A user with the HEAD_COACH role responsible for managing a center.
- **Center**: A badminton coaching center entity in the system.
- **Center_Membership**: A row in the `user_center_memberships` table linking a user to a center with a specific role.
- **Welcome_Email**: The center welcome email sent via `sendCenterWelcomeEmail` containing login information and, for new users, a password reset link.
- **Password_Reset_Token**: A cryptographically random 32-byte hex token stored as a SHA-256 hash with a 24-hour expiry.
- **Reset_Endpoint**: The API endpoint `POST /api/admin/centers/:id/resend-head-coach-reset` that re-sends a password reset link to the currently assigned head coach.

## Requirements

### Requirement 1: Send Invite — New User Flow

**User Story:** As an Admin, I want to invite a head coach by email after center creation, so that I can onboard a head coach who does not yet have an account in the system.

#### Acceptance Criteria

1. WHEN an Admin submits an email to the Invite_Endpoint that does not match any existing user (case-insensitive comparison), THE Invite_Endpoint SHALL create a new user account with the lowercased email as both the username and email fields, the role set to HEAD_COACH, and no password set.
2. WHEN the Invite_Endpoint creates a new user account, THE Invite_Endpoint SHALL generate a Password_Reset_Token with a 24-hour expiry and store the hashed token in the database.
3. WHEN the Invite_Endpoint creates a new user account, THE Invite_Endpoint SHALL create a Center_Membership record linking the new user to the specified Center with the role HEAD_COACH.
4. WHEN the Invite_Endpoint creates a new user account, THE Invite_Endpoint SHALL send the Welcome_Email to the provided email address containing the password reset link and login URL.
5. WHEN the Invite_Endpoint completes the new user flow successfully, THE Invite_Endpoint SHALL return HTTP 201 with the created user ID, email, center ID, and a flag indicating the user was newly created.
6. IF user account creation, token generation, or Center_Membership creation fails at any step, THEN THE Invite_Endpoint SHALL roll back all changes from the current request and return HTTP 500 with an error message indicating the invite could not be processed.
7. WHEN the Invite_Endpoint receives an email that exceeds 255 characters, THE Invite_Endpoint SHALL return HTTP 400 with an error message indicating the email exceeds the maximum allowed length.

### Requirement 2: Send Invite — Existing User Flow

**User Story:** As an Admin, I want to invite an existing user as head coach of an additional center, so that a user can manage multiple centers with a single login.

#### Acceptance Criteria

1. WHEN an Admin submits an email to the Invite_Endpoint that matches an existing user (case-insensitive comparison), THE Invite_Endpoint SHALL create a Center_Membership record linking the existing user to the specified Center with the role HEAD_COACH.
2. WHEN the Invite_Endpoint adds a Center_Membership for an existing user, THE Invite_Endpoint SHALL send a notification email to the user containing the center name and a login URL.
3. WHEN the Invite_Endpoint adds a Center_Membership for an existing user, THE Invite_Endpoint SHALL NOT generate a Password_Reset_Token because the user already has credentials.
4. WHEN the Invite_Endpoint completes the existing user flow successfully, THE Invite_Endpoint SHALL return HTTP 200 with the user ID, email, center ID, and a flag indicating the user already existed.

### Requirement 3: Input Validation

**User Story:** As an Admin, I want clear error messages when I provide invalid input, so that I can correct mistakes before re-submitting.

#### Acceptance Criteria

1. WHEN the email field is missing or empty, THE Invite_Endpoint SHALL return HTTP 400 with an error message indicating that email is required.
2. WHEN the email field does not conform to a valid email format (containing exactly one @ symbol followed by a domain with at least one dot) or exceeds 254 characters in length, THE Invite_Endpoint SHALL return HTTP 400 with an error message indicating that the email format is invalid.
3. WHEN the specified center ID is not a valid identifier format, THE Invite_Endpoint SHALL return HTTP 400 with an error message indicating the center ID is invalid.
4. WHEN the specified center ID is valid in format but does not match any existing center, THE Invite_Endpoint SHALL return HTTP 404 with an error message indicating the center was not found.

### Requirement 4: Conflict Prevention

**User Story:** As an Admin, I want to be prevented from creating duplicate memberships, so that data integrity is preserved.

#### Acceptance Criteria

1. WHEN an Admin submits an email to the Invite_Endpoint and the specified Center already has a Center_Membership with the role HEAD_COACH assigned to a different user, THE Invite_Endpoint SHALL return HTTP 409 with an error message indicating a head coach is already assigned to the center.
2. WHEN the matched existing user already has a Center_Membership for the specified Center with the role HEAD_COACH, THE Invite_Endpoint SHALL return HTTP 409 with an error message indicating the user is already the head coach of this center.
3. WHEN the matched existing user already has a Center_Membership for the specified Center with a role other than HEAD_COACH, THE Invite_Endpoint SHALL update the existing membership role to HEAD_COACH rather than creating a duplicate membership record for the same user and center.

### Requirement 5: Re-send Password Reset

**User Story:** As an Admin, I want to re-send a password reset link to the assigned head coach, so that the head coach can set or reset their password if the original invite expired or was lost.

#### Acceptance Criteria

1. WHEN an Admin triggers the Reset_Endpoint for a Center that has a head coach Center_Membership, THE Reset_Endpoint SHALL delete any existing Password_Reset_Tokens for that head coach user and generate a new Password_Reset_Token with a 24-hour expiry.
2. WHEN the Reset_Endpoint generates a new token, THE Reset_Endpoint SHALL send a password reset email to the head coach email address with a valid reset link containing the token and expiring in 24 hours.
3. WHEN no head coach Center_Membership exists for the specified Center, THE Reset_Endpoint SHALL return HTTP 422 with an error message indicating no head coach is assigned to this center.
4. WHEN the Reset_Endpoint completes successfully, THE Reset_Endpoint SHALL return HTTP 200 with the head coach email address and the center ID in the response body.
5. WHEN the specified center ID does not exist, THE Reset_Endpoint SHALL return HTTP 404 with an error message indicating the center was not found.
6. IF the password reset email fails to send on the first attempt, THEN THE Reset_Endpoint SHALL retry the email delivery once after a 5-second delay, and if both attempts fail, return a success response with a warning field indicating that the email could not be delivered.

### Requirement 6: Authorization

**User Story:** As the system owner, I want only authenticated admins to access the invite and reset endpoints, so that unauthorized users cannot manage head coach assignments.

#### Acceptance Criteria

1. WHEN a request with a missing or invalid or expired authentication token is made to the Invite_Endpoint, THE Invite_Endpoint SHALL return HTTP 401 with an error message indicating the request is not authenticated.
2. WHEN an authenticated user without the SUPER_ADMIN role makes a request to the Invite_Endpoint, THE Invite_Endpoint SHALL return HTTP 403 with an error message indicating the user does not have permission.
3. WHEN a request with a missing or invalid or expired authentication token is made to the Reset_Endpoint, THE Reset_Endpoint SHALL return HTTP 401 with an error message indicating the request is not authenticated.
4. WHEN an authenticated user without the SUPER_ADMIN role makes a request to the Reset_Endpoint, THE Reset_Endpoint SHALL return HTTP 403 with an error message indicating the user does not have permission.
5. WHEN a request is made to the Invite_Endpoint or Reset_Endpoint, THE system SHALL evaluate authentication before authorization, returning HTTP 401 for authentication failures before checking the user's role.

### Requirement 7: Email Delivery Resilience

**User Story:** As an Admin, I want the invite to succeed even if email delivery fails, so that the user account and membership are created and can be recovered by re-sending the invite.

#### Acceptance Criteria

1. IF the Welcome_Email or notification email raises an error or times out within 30 seconds on the first delivery attempt, THEN THE Invite_Endpoint SHALL retry the email delivery once after a 5-second delay.
2. IF the email delivery fails on both attempts, THEN THE Invite_Endpoint SHALL return the same success HTTP status code as the normal flow (HTTP 201 for new user, HTTP 200 for existing user) with the user account and Center_Membership created and persisted.
3. IF the email delivery fails on both attempts, THEN THE Invite_Endpoint SHALL include a warning field in the JSON response body indicating that the email could not be delivered.
4. THE Invite_Endpoint SHALL persist the user account and Center_Membership to the database before attempting email delivery, so that data is not lost if email fails.
5. WHILE the Invite_Endpoint is retrying email delivery, THE Invite_Endpoint SHALL block the response until the retry completes or fails, returning the final result including any warning within a maximum total request duration of 45 seconds.
