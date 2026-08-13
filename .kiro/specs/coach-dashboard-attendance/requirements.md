# Requirements Document

## Introduction

The Coach Dashboard Attendance feature enhances the coach dashboard with a prominent, intuitive attendance management block. Coaches see today's sessions in a clear calendar view and can mark student attendance (present/absent) for the current or next session directly from the dashboard. The feature supports both HEAD_COACH (sees all batches) and ASSISTANT_COACH (sees only assigned batches) roles, leveraging the existing attendance API and session calendar infrastructure.

## Glossary

- **Dashboard_Attendance_Block**: A dashboard widget that displays today's sessions and allows coaches to mark attendance for students in the current session
- **Session_Calendar_View**: A visual representation of today's scheduled sessions showing time, batch name, and session status
- **Current_Session**: The session that is either in-progress (current time falls between start and end time) or the next upcoming session for today based on the batch schedule
- **HEAD_COACH**: A coach role with visibility into all batches and all students across the academy
- **ASSISTANT_COACH**: A coach role with visibility restricted to batches and students explicitly assigned to them
- **Attendance_Status**: The presence state of a student for a session, either PRESENT or ABSENT (may also include LATE)
- **Batch_Schedule**: The recurring day-of-week and time configuration that determines when a batch has sessions
- **Student_List**: The roster of students enrolled in a specific batch who should have attendance recorded

## Requirements

### Requirement 1: Today's Session Calendar Display

**User Story:** As a coach, I want to see today's scheduled sessions prominently on my dashboard, so that I can quickly identify which sessions require attendance marking.

#### Acceptance Criteria

1. WHEN the coach opens the dashboard, THE Session_Calendar_View SHALL display all sessions scheduled for the current date
2. THE Session_Calendar_View SHALL display each session with the batch name, start time, and end time
3. WHEN a session has attendance already recorded, THE Session_Calendar_View SHALL display a visual indicator distinguishing it from sessions without recorded attendance
4. WHEN no sessions are scheduled for today, THE Session_Calendar_View SHALL display a message indicating no sessions are available today
5. THE Session_Calendar_View SHALL order sessions chronologically by start time

### Requirement 2: Current Session Detection

**User Story:** As a coach, I want the dashboard to automatically identify the current or next session, so that attendance marking is contextually relevant without manual selection.

#### Acceptance Criteria

1. WHEN the current time falls between a session's start time and end time, THE Dashboard_Attendance_Block SHALL identify that session as the Current_Session
2. WHEN no session is currently in-progress, THE Dashboard_Attendance_Block SHALL identify the next upcoming session for today as the Current_Session
3. WHEN all sessions for today have ended, THE Dashboard_Attendance_Block SHALL identify the last session of the day as the Current_Session if attendance has not been recorded for it
4. WHEN all sessions for today have attendance recorded, THE Dashboard_Attendance_Block SHALL display a completion state indicating all attendance is submitted

### Requirement 3: Student List for Attendance

**User Story:** As a coach, I want to see all students enrolled in the current session's batch, so that I can mark attendance for each student.

#### Acceptance Criteria

1. WHEN a Current_Session is identified, THE Dashboard_Attendance_Block SHALL display the Student_List for the batch associated with that session
2. THE Dashboard_Attendance_Block SHALL display each student's full name in the Student_List
3. WHEN the Student_List is loading, THE Dashboard_Attendance_Block SHALL display a loading indicator
4. WHEN the batch has no enrolled students, THE Dashboard_Attendance_Block SHALL display a message indicating no students are in the batch

### Requirement 4: Single-Tap Attendance Marking

**User Story:** As a coach, I want to mark each student present or absent with a single tap, so that attendance recording is fast and efficient during sessions.

#### Acceptance Criteria

1. THE Dashboard_Attendance_Block SHALL display a present toggle and an absent toggle for each student in the Student_List
2. WHEN the coach taps the present toggle for a student, THE Dashboard_Attendance_Block SHALL mark that student as PRESENT with a visual confirmation
3. WHEN the coach taps the absent toggle for a student, THE Dashboard_Attendance_Block SHALL mark that student as ABSENT with a visual confirmation
4. WHEN a student status is toggled, THE Dashboard_Attendance_Block SHALL update the visual state immediately without waiting for a server response
5. THE Dashboard_Attendance_Block SHALL provide a submit button to persist all attendance records to the server
6. WHEN the submit button is pressed, THE Dashboard_Attendance_Block SHALL send all attendance records to the attendance API for the session date and batch
7. IF the attendance submission fails, THEN THE Dashboard_Attendance_Block SHALL display an error message and retain the marked states for retry
8. WHEN attendance is submitted successfully, THE Dashboard_Attendance_Block SHALL display a success confirmation

### Requirement 5: Role-Based Batch Visibility

**User Story:** As a coach, I want to see only the batches relevant to my role, so that I am not overwhelmed by information outside my responsibility.

#### Acceptance Criteria

1. WHILE the logged-in user has the HEAD_COACH role, THE Dashboard_Attendance_Block SHALL display sessions for all batches in the academy
2. WHILE the logged-in user has the ASSISTANT_COACH role, THE Dashboard_Attendance_Block SHALL display sessions only for batches assigned to that coach
3. THE Dashboard_Attendance_Block SHALL filter the session calendar entries based on the coach's role before rendering

### Requirement 6: Dashboard Integration

**User Story:** As a coach, I want the attendance block to be a prominent part of my dashboard layout, so that marking attendance is always accessible and visible.

#### Acceptance Criteria

1. THE Dashboard_Attendance_Block SHALL be displayed on both the HeadCoachDashboard and AssistantCoachDashboard pages
2. THE Dashboard_Attendance_Block SHALL be positioned prominently in the dashboard layout above secondary widgets
3. WHEN the session calendar data is loading, THE Dashboard_Attendance_Block SHALL display a loading skeleton that matches the widget dimensions
4. THE Dashboard_Attendance_Block SHALL use the existing useSessionCalendar hook to fetch calendar data
5. THE Dashboard_Attendance_Block SHALL use the existing attendance API endpoint to submit attendance records

### Requirement 7: Multiple Sessions Navigation

**User Story:** As a coach with multiple sessions today, I want to navigate between sessions to mark attendance for each, so that all sessions are covered without leaving the dashboard.

#### Acceptance Criteria

1. WHEN multiple sessions are scheduled for today, THE Dashboard_Attendance_Block SHALL allow the coach to select which session to mark attendance for
2. WHEN the coach selects a different session, THE Dashboard_Attendance_Block SHALL load the Student_List for the newly selected session's batch
3. THE Dashboard_Attendance_Block SHALL indicate which sessions have attendance already recorded and which are pending
