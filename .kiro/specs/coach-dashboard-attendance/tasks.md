# Implementation Plan: Coach Dashboard Attendance

## Overview

Replace the existing `QuickAttendanceWidget` with a comprehensive `DashboardAttendanceBlock` component that provides today's session calendar view, automatic current-session detection, multi-session navigation, and single-tap attendance marking. All code is frontend-only (TypeScript/React) in the `shuttlecoach` app.

## Tasks

- [x] 1. Create utility functions and the useBatchStudents hook
  - [x] 1.1 Create `getTodaySessions` and `getCurrentSession` utility functions
    - Create file `src/utils/attendanceBlockUtils.ts`
    - Implement `getTodaySessions(entries: CalendarEntry[]): CalendarEntry[]` — filters to today, sorts by startTime
    - Implement `getCurrentSession(todaySessions: CalendarEntry[], now: Date): { session: CalendarEntry | null; index: number }` — follows the detection algorithm from design (in-progress → next upcoming → last unrecorded → null)
    - Export both functions
    - _Requirements: 1.5, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.2 Write property tests for `getTodaySessions` (Property 1 & 3)
    - **Property 1: Today's session rendering completeness** — for any CalendarEntry[] with some entries dated today, getTodaySessions returns exactly those entries with valid batchName, startTime, endTime
    - **Property 3: Session chronological ordering** — output is sorted by startTime
    - **Validates: Requirements 1.1, 1.2, 1.5**
    - Use `fast-check` library, minimum 100 iterations

  - [ ]* 1.3 Write property tests for `getCurrentSession` (Property 2)
    - **Property 2: Current session detection correctness** — for any non-empty today sessions and any time, getCurrentSession returns the correct session per the algorithm
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - Use `fast-check` library, minimum 100 iterations

  - [x] 1.4 Create `useBatchStudents` hook
    - Create file `src/hooks/useBatchStudents.ts`
    - Implement `useBatchStudents(batchId: string | undefined): { students: Student[]; loading: boolean; error: string | null }`
    - Fetch from `GET /api/students?batchId=X` via existing `apiClient`
    - Re-fetch when batchId changes, return empty array when batchId is undefined
    - _Requirements: 3.1, 3.3_

- [x] 2. Build the DashboardAttendanceBlock sub-components
  - [x] 2.1 Create `SessionTabBar` component
    - Create file `src/components/attendance/SessionTabBar.tsx`
    - Props: `sessions: CalendarEntry[]`, `selectedIndex: number`, `onSelect: (index: number) => void`
    - Render horizontal tabs/chips for each session showing batchName and time range
    - Visually distinguish sessions with `attendanceRecorded === true` (recorded indicator) vs pending
    - Highlight the currently selected session
    - _Requirements: 1.2, 1.3, 7.1, 7.3_

  - [x] 2.2 Create `StudentAttendanceRow` component
    - Create file `src/components/attendance/StudentAttendanceRow.tsx`
    - Props: `student: Student`, `status: AttendanceStatus | undefined`, `onToggle: (studentId: string, status: AttendanceStatus) => void`
    - Render student fullName with Present/Absent toggle buttons (P/A)
    - Apply visual confirmation (color change) immediately on toggle for optimistic UI
    - Include accessible aria-labels for each toggle button
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Create `StudentAttendanceList` component
    - Create file `src/components/attendance/StudentAttendanceList.tsx`
    - Props: `students: Student[]`, `attendanceMap: Record<string, AttendanceStatus>`, `onToggle`, `loading: boolean`
    - Handle loading state (show loading indicator), empty state (no students message), and normal list rendering
    - Render a `StudentAttendanceRow` for each student
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.4 Create `AttendanceSubmitFooter` component
    - Create file `src/components/attendance/AttendanceSubmitFooter.tsx`
    - Props: `allMarked: boolean`, `submitting: boolean`, `error: string | null`, `onSubmit: () => void`
    - Render submit button, disabled until all students marked
    - Show error message on failure, show submitting state
    - _Requirements: 4.5, 4.7_

- [x] 3. Checkpoint - Ensure all sub-components compile and render in isolation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Assemble the DashboardAttendanceBlock and integrate into dashboards
  - [x] 4.1 Create the main `DashboardAttendanceBlock` component
    - Create file `src/components/attendance/DashboardAttendanceBlock.tsx`
    - Props: `calendarEntries: CalendarEntry[]`, `calendarLoading: boolean`
    - Internal state: `selectedSessionIndex`, `attendanceMap`, `widgetState` ('loading' | 'no-sessions' | 'idle' | 'submitting' | 'success' | 'all-complete')
    - On mount: call `getTodaySessions` → `getCurrentSession` to auto-select session
    - Use `useBatchStudents` with selected session's batchId
    - Use `useMarkAttendance` for submission
    - Handle states: loading skeleton, no sessions today, all-complete, idle with student list, success confirmation
    - Wire submit: build `MarkAttendanceData` payload from attendanceMap, submit via hook, show success/error
    - On session tab change: reset attendanceMap, load new students
    - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 4.4, 4.5, 4.6, 4.7, 4.8, 6.3, 6.4, 6.5, 7.1, 7.2_

  - [ ]* 4.2 Write property test for attendance submission payload (Property 5)
    - **Property 5: Attendance submission payload integrity** — for any attendanceMap where all students have a status, the payload contains exactly one record per student with correct studentId, status, batchId, sessionDate
    - **Validates: Requirements 4.6**
    - Use `fast-check` library, minimum 100 iterations

  - [x] 4.3 Integrate `DashboardAttendanceBlock` into `HeadCoachDashboard`
    - In `src/pages/HeadCoachDashboard.tsx`: replace the `QuickAttendanceWidget` usage with `DashboardAttendanceBlock`
    - Move the attendance block above the overview grid (prominent position)
    - Pass `calendarEntries` and `calendarLoading` props (already available)
    - Remove `QuickAttendanceWidget` import if no longer used
    - _Requirements: 5.1, 6.1, 6.2, 6.4_

  - [x] 4.4 Integrate `DashboardAttendanceBlock` into `AssistantCoachDashboard`
    - In `src/pages/AssistantCoachDashboard.tsx`: replace the `QuickAttendanceWidget` usage with `DashboardAttendanceBlock`
    - Move the attendance block above the overview grid (prominent position)
    - Pass `calendarEntries` and `calendarLoading` props (already available)
    - Remove `QuickAttendanceWidget` import if no longer used
    - _Requirements: 5.2, 6.1, 6.2, 6.4_

  - [ ]* 4.5 Write unit tests for DashboardAttendanceBlock
    - Test loading skeleton renders when calendarLoading is true
    - Test empty state ("No sessions scheduled today") renders with no today sessions
    - Test "all-complete" state when all sessions have attendanceRecorded === true
    - Test session tab selection triggers student re-fetch
    - Test submit button disabled until all students marked
    - Test success confirmation after successful submission
    - Test error message displayed on submission failure
    - _Requirements: 1.4, 2.4, 4.5, 4.7, 4.8, 6.3_

- [x] 5. Role-based filtering and final wiring
  - [x] 5.1 Ensure role-based session filtering is correct
    - Verify that `useSessionCalendar` already filters by coach role (HEAD_COACH sees all, ASSISTANT_COACH sees assigned batches)
    - If not filtered at API level, add client-side filtering in `DashboardAttendanceBlock` based on user role from `useAuth`
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 5.2 Write integration tests for role-based rendering
    - Test HEAD_COACH sees all batch sessions
    - Test ASSISTANT_COACH sees only assigned batch sessions
    - Test component renders on both dashboard pages
    - _Requirements: 5.1, 5.2, 6.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All new component files go under `src/components/attendance/` for organization
- The existing `QuickAttendanceWidget` can be kept for backward compatibility or deprecated after deployment
- No new backend APIs are needed — this is entirely frontend work in the `shuttlecoach` app

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "2.2", "2.4"] },
    { "id": 2, "tasks": ["2.3"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["4.5", "5.1"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
