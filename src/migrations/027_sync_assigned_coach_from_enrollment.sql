-- Sync assigned_coach_id From Active Enrollment
-- Version: 027
-- Description: createEnrollment() (the per-student journey system introduced in migration 026)
--              never wrote back to students.assigned_coach_id, so any coach reassignment made
--              through the enrollment flow left that legacy column stale. StudentListTable,
--              CoachListTable, and the coach filter dropdown all still read it directly, so
--              coach names went missing/stale and coach student-counts stopped updating.
--              The application code now keeps this column in sync going forward (see
--              enrollmentService.createEnrollment); this one-time backfill catches up any
--              students whose column already drifted before that fix.

UPDATE students s
SET assigned_coach_id = e.coach_id
FROM student_enrollments e
WHERE e.student_id = s.id
  AND e.status = 'active'
  AND s.assigned_coach_id IS DISTINCT FROM e.coach_id;
