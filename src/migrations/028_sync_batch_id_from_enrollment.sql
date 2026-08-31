-- Sync batch_id From Active Enrollment's Timing Template
-- Version: 028
-- Description: createEnrollment() never wrote back to students.batch_id (only
--              assigned_coach_id was fixed in migration 027), so a student's batch could drift
--              out of sync with their actual active enrollment whenever the enrollment's
--              batch_time_template_id changed but nothing re-ran the legacy batch link — or the
--              legacy batch was changed directly by a since-removed manual "Update Batch"
--              control, bypassing the enrollment entirely. "Academy Information" and the
--              schedule calendar both read students.batch_id directly, so they showed a batch
--              that no longer matched what the enrollment said. The application code now keeps
--              this column in sync going forward (see enrollmentService.createEnrollment); this
--              one-time backfill catches up any students whose column already drifted.

UPDATE students s
SET batch_id = b.id
FROM student_enrollments e
JOIN batches b ON b.template_id = e.batch_time_template_id AND b.is_archived = false
WHERE e.student_id = s.id
  AND e.status = 'active'
  AND e.batch_time_template_id IS NOT NULL
  AND s.batch_id IS DISTINCT FROM b.id;
