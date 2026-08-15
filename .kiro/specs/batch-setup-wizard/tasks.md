# Implementation Plan: Batch Setup Wizard

## Overview

Replace the existing modal-based batch creation/editing flow with a full-page, multi-step wizard at `/batches/new` and `/batches/:id/edit`. Simplify TopNav to 4 primary items. All code lives in the frontend project (`shuttlecoach`). No new backend APIs needed — reuses existing endpoints.

## Tasks

- [x] 1. Set up wizard infrastructure and routing
  - [x] 1.1 Create WizardContext with full state management
    - Create `src/components/batch-wizard/WizardContext.tsx`
    - Implement `WizardState` interface, `WizardContextValue`, and `WizardProvider`
    - Include `updateSchedule`, `updateCurriculum`, `updateCoach`, `updateDetails`, `goToStep`, `goNext`, `goBack`, `canGoNext`, `canGoToStep`, `isStepValid`, `reset`, `getSubmitPayload` methods
    - Implement step validation rules per design (Step 0 requires template, Steps 1-2 optional, Step 3 requires name)
    - _Requirements: 1.3, 1.4, 1.6, 2.5_

  - [x] 1.2 Create WizardShell and StepperNav components
    - Create `src/components/batch-wizard/WizardShell.tsx` — renders StepperNav + StepContent + StepActions
    - Create `src/components/batch-wizard/StepperNav.tsx` — 4-step tab headings with current/completed step indicators
    - Create `src/components/batch-wizard/StepActions.tsx` — Back/Next/Cancel/Submit button bar
    - Use project CSS variables and design tokens for styling
    - Create corresponding CSS files (`WizardShell.css`, `StepperNav.css`, `StepActions.css`)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [x] 1.3 Create BatchWizardPage and add routes to App.tsx
    - Create `src/pages/BatchWizardPage.tsx` — wraps `WizardProvider` + `WizardShell`
    - Support `create` mode at `/batches/new` and `edit` mode at `/batches/:id/edit`
    - Add routes in `App.tsx` with `ProtectedRoute allowedRoles={['HEAD_COACH']}`
    - Wire `beforeunload` listener for dirty state
    - _Requirements: 1.1, 6.1, 6.2, 7.1_

- [x] 2. Implement Step 1 — Batch Timing Template
  - [x] 2.1 Create ScheduleStep component with template selection and inline creation
    - Create `src/components/batch-wizard/ScheduleStep.tsx`
    - Fetch existing templates via `GET /api/batch-time-templates` (create `useBatchTemplates` hook)
    - Display template list as selectable cards showing days/time/duration
    - Add collapsible "Create New Template" inline form with: name, day-of-week toggles (Sun–Sat), start time picker, duration dropdown (1, 1.5, 2, 2.5, 3, 3.5, 4 hrs)
    - On new template creation, POST to `/api/batch-time-templates` then select the new template
    - Display selected schedule summary below the selection
    - Create `ScheduleStep.css` for styling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.2 Write property test for template creation validation (Property 3)
    - **Property 3: Template creation validation**
    - Use `fast-check` to generate random template inputs and verify validation accepts only valid combinations (non-empty name, ≥1 day, start time present, duration in allowed set)
    - **Validates: Requirements 2.3**

- [x] 3. Implement Step 2 — Curriculum Preparation
  - [x] 3.1 Create CurriculumStep component with course selection and inline creation
    - Create `src/components/batch-wizard/CurriculumStep.tsx`
    - Reuse existing `useCourses` hook to fetch courses via `GET /api/courses`
    - Display courses as selectable cards (name + week count)
    - Add collapsible "Create New Course" inline form (name only)
    - Show selected curriculum summary; allow deselection (optional step)
    - Create `CurriculumStep.css` for styling
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Implement Step 3 — Assign Coach
  - [x] 4.1 Create CoachStep component with coach selection cards
    - Create `src/components/batch-wizard/CoachStep.tsx`
    - Fetch coaches via `GET /api/coaches` (create `useCoaches` hook if not existing)
    - Display coach cards showing name and role (HEAD_COACH / ASSISTANT_COACH)
    - Allow selection or deselection (optional step)
    - Show selected coach confirmation
    - Create `CoachStep.css` for styling
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 4.2 Write property test for coach card display (Property 7)
    - **Property 7: Coach card displays name and role**
    - Use `fast-check` to generate random coach objects, render CoachStep card, assert output contains name and role text
    - **Validates: Requirements 4.2**

- [x] 5. Checkpoint - Ensure steps 1-3 render and validate correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Step 4 — Batch Details and Submission
  - [x] 6.1 Create DetailsStep component with summary and form fields
    - Create `src/components/batch-wizard/DetailsStep.tsx`
    - Display read-only SummaryCard showing Steps 1–3 selections (template days/time, curriculum name/weeks, coach name/role); show "None selected" for skipped optional steps
    - Add form fields: batch name (required, text), skill level (dropdown: Beginner/Intermediate/Advanced/Professional), capacity (positive integer input)
    - Validate: name non-empty after trim, capacity positive integer or empty
    - No fee-related fields
    - Create `DetailsStep.css` for styling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.1, 8.2_

  - [x] 6.2 Implement batch submission logic (create and edit)
    - In create mode: call `POST /api/batches` with payload from `getSubmitPayload()`
    - If a new template was created inline, ensure template POST completes first and `template_id` is set
    - In edit mode: call `PATCH /api/batches/:id` with updated payload
    - On success: navigate to `/batches` + show success toast
    - On error: display inline error on Step 4, remain on page
    - _Requirements: 5.7, 5.8, 5.9, 6.4, 6.5_

  - [ ]* 6.3 Write property test for Step 4 field validation (Property 5)
    - **Property 5: Step 4 field validation**
    - Use `fast-check` to generate random strings and numbers, assert empty/whitespace names rejected, non-positive/fractional capacity rejected, valid combos accepted
    - **Validates: Requirements 5.2, 5.4**

  - [ ]* 6.4 Write property test for summary display completeness (Property 4)
    - **Property 4: Step 4 summary displays all prior selections**
    - Use `fast-check` to generate random wizard states with various selections, assert SummaryCard text contains all selected values or "None selected"
    - **Validates: Requirements 2.4, 3.3, 4.2, 5.5**

- [x] 7. Implement Edit Mode pre-population
  - [x] 7.1 Implement batchToWizardState mapping and edit route loading
    - In `BatchWizardPage`, detect `:id` param for edit mode
    - Fetch batch details and map to wizard state using `batchToWizardState` function
    - Mark all steps as completed; set mode to 'edit'
    - Update page title to "Edit Batch" and submit button to "Save Changes"
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 7.2 Write property test for edit mode pre-population (Property 6)
    - **Property 6: Edit mode pre-population correctness**
    - Use `fast-check` to generate random batch records, apply `batchToWizardState`, assert all fields correctly mapped and all steps marked completed
    - **Validates: Requirements 6.1**

- [x] 8. Checkpoint - Ensure wizard create and edit flows work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create BatchListPage and simplify navigation
  - [x] 9.1 Create BatchListPage to replace existing batches route
    - Create `src/pages/BatchListPage.tsx`
    - Fetch batches via existing `GET /api/batches`
    - Display batch cards/list with name, schedule summary, coach, skill level
    - HEAD_COACH: show "Add Batch" button (navigates to `/batches/new`) and "Edit" per batch (navigates to `/batches/:id/edit`)
    - ASSISTANT_COACH: read-only view, no Add/Edit buttons
    - Create `BatchListPage.css` for styling
    - Replace existing `/batches` route in `App.tsx` to use `BatchListPage`
    - _Requirements: 1.1, 7.1, 7.2, 7.3_

  - [x] 9.2 Simplify TopNav to 4 primary items
    - Update `COACH_NAV` in `src/components/TopNav.tsx` to: Dashboard, Batches (direct link), Students (direct link), Finance (dropdown: Fees, Accounts)
    - Remove the Training dropdown entirely
    - Remove Courses, Drills, Calendar, Attendance, Analytics from primary nav
    - Ensure Calendar/Attendance remain accessible from Dashboard contextual links
    - Ensure Drills accessible from batch wizard curriculum step or BatchListPage secondary link
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

- [x] 10. Implement navigation state properties
  - [x] 10.1 Write property test for back navigation state preservation (Property 1)
    - **Property 1: Back navigation preserves wizard state**
    - Use `fast-check` to generate random wizard states, apply goBack+goNext, assert state equality across all step data fields
    - **Validates: Requirements 1.4**

  - [ ]* 10.2 Write property test for forward navigation gating (Property 2)
    - **Property 2: Forward navigation gating by step validity**
    - Use `fast-check` to generate random step validity arrays, assert canGoToStep matches spec (step N accessible only when 0..N-1 all valid)
    - **Validates: Requirements 1.6, 2.5**

- [x] 11. Final checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All new components go under `src/components/batch-wizard/` in the frontend project
- Pages go at `src/pages/BatchWizardPage.tsx` and `src/pages/BatchListPage.tsx`
- Use project's CSS variables, Tailwind CSS 4, and component-level CSS files
- Reuse existing hooks (`useCourses`) and create new ones (`useBatchTemplates`, `useCoaches`) as needed
- The design uses TypeScript with React — all implementation follows project conventions

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "4.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "9.1"] },
    { "id": 7, "tasks": ["9.2"] },
    { "id": 8, "tasks": ["10.1", "10.2"] }
  ]
}
```
