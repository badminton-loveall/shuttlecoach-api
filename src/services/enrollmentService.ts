import { query } from '../config/database';
import { getCycleKeyForDate } from '../utils/calculations';
import { WeekPlan } from '../types';

export interface WeekSchedule {
  weekNumber: number;
  scheduledStart: string; // YYYY-MM-DD
  scheduledEnd: string; // YYYY-MM-DD
}

// Local-component formatting, not toISOString() (UTC) — a Date built via new Date(y, m, d) or
// .setDate() carries the calendar date in its LOCAL components; reading it back through UTC
// shifts the displayed day by the server's UTC offset whenever local time isn't already UTC
// (e.g. this differs on a developer's own machine vs. a server that happens to run UTC).
const toIsoDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Compute a per-week calendar for a curriculum of `weekCount` weeks starting on `startDate`.
 * Each week is a fixed 7-day block — week 1 covers [startDate, startDate+6], week 2 the next
 * 7 days, and so on. This is deliberately calendar-only (not tied to specific session-slot
 * weekdays) so it works the same regardless of how many sessions/week the template has.
 */
export function computeWeekSchedule(startDate: Date, weekCount: number): WeekSchedule[] {
  const schedule: WeekSchedule[] = [];
  for (let week = 1; week <= weekCount; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    schedule.push({
      weekNumber: week,
      scheduledStart: toIsoDate(weekStart),
      scheduledEnd: toIsoDate(weekEnd),
    });
  }
  return schedule;
}

export function computeProjectedEndDate(startDate: Date, weekCount: number): string | null {
  if (weekCount <= 0) return null;
  const schedule = computeWeekSchedule(startDate, weekCount);
  return schedule[schedule.length - 1].scheduledEnd;
}

interface CreateEnrollmentParams {
  studentId: string;
  batchTimeTemplateId?: string | null;
  curriculumId?: string | null;
  coachId?: string | null;
  startDate: string;
  monthlyFee?: number | null;
  centerId: string | null;
  isBackfilled?: boolean;
}

/**
 * Create a new active enrollment for a student, ending whatever enrollment was previously
 * active. If a curriculum is chosen, seeds a fresh student-owned curriculum_plans row (from the
 * course template, never from a batch plan) and a student_drill_records row per drill per week —
 * the durable ledger entries that survive future enrollment changes.
 */
export async function createEnrollment(params: CreateEnrollmentParams) {
  const {
    studentId,
    batchTimeTemplateId = null,
    curriculumId = null,
    coachId = null,
    startDate,
    monthlyFee = null,
    centerId,
    isBackfilled = false,
  } = params;

  // End any currently active enrollment for this student — history is preserved, not deleted.
  await query(
    `UPDATE student_enrollments SET status = 'ended' WHERE student_id = $1 AND status = 'active'`,
    [studentId]
  );

  let weeks: WeekPlan[] = [];
  if (curriculumId) {
    const courseResult = await query(`SELECT weeks FROM courses WHERE id = $1`, [curriculumId]);
    if (courseResult.rows.length > 0) {
      const raw = courseResult.rows[0].weeks;
      weeks = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
  }

  const start = new Date(startDate);
  const projectedEndDate = weeks.length > 0 ? computeProjectedEndDate(start, weeks.length) : null;

  const enrollmentResult = await query(
    `INSERT INTO student_enrollments (
      student_id, batch_time_template_id, curriculum_id, coach_id,
      start_date, projected_end_date, monthly_fee, status, is_backfilled, center_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)
    RETURNING id, student_id, batch_time_template_id, curriculum_id, coach_id,
      start_date, projected_end_date, monthly_fee, status, is_backfilled, created_at, updated_at`,
    [
      studentId,
      batchTimeTemplateId,
      curriculumId,
      coachId,
      startDate,
      projectedEndDate,
      monthlyFee,
      isBackfilled,
      centerId,
    ]
  );

  const enrollment = enrollmentResult.rows[0];

  // Keep the legacy students.assigned_coach_id column in sync with the now-active enrollment —
  // StudentListTable, CoachListTable, and the coach filter dropdown all still read the student
  // record directly rather than joining through student_enrollments.
  await query(`UPDATE students SET assigned_coach_id = $1 WHERE id = $2`, [coachId, studentId]);

  // Same for the legacy students.batch_id column — resolve it via the batches row linked to
  // this timing template (if any) so "Academy Information" and the schedule calendar reflect
  // the enrollment's actual template instead of whatever batch was last set directly.
  let resolvedBatchId: string | null = null;
  if (batchTimeTemplateId) {
    const batchResult = await query(
      `SELECT id FROM batches WHERE template_id = $1 AND is_archived = false LIMIT 1`,
      [batchTimeTemplateId]
    );
    resolvedBatchId = batchResult.rows[0]?.id ?? null;
  }
  await query(`UPDATE students SET batch_id = $1 WHERE id = $2`, [resolvedBatchId, studentId]);

  if (curriculumId && weeks.length > 0) {
    const numberedWeeks = weeks.map((week, index) => ({ ...week, weekNumber: index + 1 }));

    await query(
      `INSERT INTO curriculum_plans (cycle_key, student_id, weeks, is_archived, center_id)
       VALUES ($1, $2, $3, false, $4)`,
      [getCycleKeyForDate(start), studentId, JSON.stringify(numberedWeeks), centerId]
    );

    const schedule = computeWeekSchedule(start, numberedWeeks.length);
    const scheduleByWeek = new Map(schedule.map((s) => [s.weekNumber, s]));

    for (const week of numberedWeeks) {
      const weekSchedule = scheduleByWeek.get(week.weekNumber);
      for (const drill of week.drills || []) {
        await query(
          `INSERT INTO student_drill_records (
            student_id, enrollment_id, curriculum_id, drill_id, week_number,
            scheduled_start, scheduled_end, status, center_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)`,
          [
            studentId,
            enrollment.id,
            curriculumId,
            drill.id,
            week.weekNumber,
            weekSchedule?.scheduledStart || null,
            weekSchedule?.scheduledEnd || null,
            centerId,
          ]
        );
      }
    }
  }

  return enrollment;
}

/**
 * Re-sync the not-yet-trained drill records for a student-owned curriculum plan after the coach
 * edits or reorders it. Trained/skipped records (real history) are never touched. Drills removed
 * from the plan and never trained are deleted; drills still present get their week/schedule
 * updated to match the new plan; newly added drills get a fresh scheduled record.
 */
export async function syncDrillRecordsForEnrollment(
  enrollmentId: string,
  studentId: string,
  curriculumId: string | null,
  weeks: WeekPlan[],
  centerId: string | null
): Promise<void> {
  const enrollmentResult = await query(
    `SELECT start_date FROM student_enrollments WHERE id = $1`,
    [enrollmentId]
  );
  if (enrollmentResult.rows.length === 0) return;

  const startDate = new Date(enrollmentResult.rows[0].start_date);
  const schedule = computeWeekSchedule(startDate, weeks.length);
  const scheduleByWeek = new Map(schedule.map((s) => [s.weekNumber, s]));

  // Expected (drill_id -> week_number) from the freshly saved plan
  const expected = new Map<string, number>();
  for (const week of weeks) {
    for (const drill of week.drills || []) {
      expected.set(drill.id, week.weekNumber);
    }
  }

  const existingResult = await query(
    `SELECT id, drill_id, status FROM student_drill_records
     WHERE enrollment_id = $1 AND status = 'scheduled'`,
    [enrollmentId]
  );

  const existingByDrill = new Map<string, { id: string }>();
  for (const row of existingResult.rows) {
    existingByDrill.set(row.drill_id, { id: row.id });
  }

  // Remove scheduled records for drills no longer in the plan
  for (const [drillId, row] of existingByDrill) {
    if (!expected.has(drillId)) {
      await query(`DELETE FROM student_drill_records WHERE id = $1`, [row.id]);
    }
  }

  // Update or insert records for drills still (or newly) in the plan
  for (const [drillId, weekNumber] of expected) {
    const weekSchedule = scheduleByWeek.get(weekNumber);
    const existing = existingByDrill.get(drillId);
    if (existing) {
      await query(
        `UPDATE student_drill_records
         SET week_number = $1, scheduled_start = $2, scheduled_end = $3
         WHERE id = $4`,
        [weekNumber, weekSchedule?.scheduledStart || null, weekSchedule?.scheduledEnd || null, existing.id]
      );
    } else {
      await query(
        `INSERT INTO student_drill_records (
          student_id, enrollment_id, curriculum_id, drill_id, week_number,
          scheduled_start, scheduled_end, status, center_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8)`,
        [
          studentId,
          enrollmentId,
          curriculumId,
          drillId,
          weekNumber,
          weekSchedule?.scheduledStart || null,
          weekSchedule?.scheduledEnd || null,
          centerId,
        ]
      );
    }
  }
}
