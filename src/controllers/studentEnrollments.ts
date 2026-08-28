import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';
import { createEnrollment, syncDrillRecordsForEnrollment } from '../services/enrollmentService';

/**
 * POST /api/students/:studentId/enrollments
 * Create a new active enrollment (template + curriculum + coach + start date + fee) for a
 * student, ending whatever enrollment was previously active. History is never overwritten.
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const createStudentEnrollment = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const studentId = req.params.studentId as string;
    const { batchTimeTemplateId, curriculumId, coachId, startDate, monthlyFee } = req.body;
    const centerId = req.tenantCenterId || null;

    const studentCheck = await query(
      `SELECT id FROM students WHERE id = $1 ${centerId ? 'AND center_id = $2' : ''}`,
      centerId ? [studentId, centerId] : [studentId]
    );
    if (studentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const enrollment = await createEnrollment({
      studentId,
      batchTimeTemplateId,
      curriculumId,
      coachId,
      startDate,
      monthlyFee,
      centerId,
    });

    res.status(201).json(mapEnrollment(enrollment));
  } catch (error) {
    console.error('Create student enrollment error:', error);
    res.status(500).json({ error: 'An error occurred while creating the enrollment' });
  }
};

/**
 * GET /api/students/:studentId/enrollments
 * Full enrollment history for a student, most recent first.
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listStudentEnrollments = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { studentId } = req.params;

    const result = await query(
      `SELECT e.id, e.student_id, e.batch_time_template_id, e.curriculum_id, e.coach_id,
              e.start_date, e.projected_end_date, e.monthly_fee, e.status, e.is_backfilled,
              e.created_at, e.updated_at,
              t.name AS template_name, c.name AS curriculum_name, u.name AS coach_name
       FROM student_enrollments e
       LEFT JOIN batch_time_templates t ON t.id = e.batch_time_template_id
       LEFT JOIN courses c ON c.id = e.curriculum_id
       LEFT JOIN users u ON u.id = e.coach_id
       WHERE e.student_id = $1
       ORDER BY e.start_date DESC, e.created_at DESC`,
      [studentId]
    );

    res.status(200).json(result.rows.map(mapEnrollmentWithNames));
  } catch (error) {
    console.error('List student enrollments error:', error);
    res.status(500).json({ error: 'An error occurred while fetching enrollments' });
  }
};

/**
 * GET /api/students/:studentId/drill-records
 * Full lifetime drill ledger for a student, across every enrollment they've ever had.
 * Pass ?enrollmentId=<id> to scope to a single enrollment (e.g. "current curriculum coverage").
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listStudentDrillRecords = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { enrollmentId } = req.query;

    const conditions = ['r.student_id = $1'];
    const params: any[] = [studentId];
    if (enrollmentId) {
      conditions.push(`r.enrollment_id = $${params.length + 1}`);
      params.push(enrollmentId);
    }

    const result = await query(
      `SELECT r.id, r.student_id, r.enrollment_id, r.curriculum_id, r.drill_id,
              r.week_number, r.scheduled_start, r.scheduled_end, r.status, r.level,
              r.coach_notes, r.trained_at, r.assessed_by,
              d.name AS drill_name, d.category AS drill_category,
              c.name AS curriculum_name,
              e.coach_id, e.status AS enrollment_status, e.start_date AS enrollment_start_date,
              u.name AS coach_name
       FROM student_drill_records r
       LEFT JOIN drills d ON d.id = r.drill_id
       LEFT JOIN courses c ON c.id = r.curriculum_id
       LEFT JOIN student_enrollments e ON e.id = r.enrollment_id
       LEFT JOIN users u ON u.id = e.coach_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.start_date DESC, r.week_number ASC`,
      params
    );

    res.status(200).json(result.rows.map(mapDrillRecord));
  } catch (error) {
    console.error('List student drill records error:', error);
    res.status(500).json({ error: 'An error occurred while fetching drill records' });
  }
};

/**
 * PATCH /api/students/:studentId/drill-records/:id
 * Record a drill as trained (with level + notes) or skipped.
 * Requires: HEAD_COACH or assigned ASSISTANT_COACH
 */
export const updateStudentDrillRecord = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, level, coachNotes } = req.body;

    const trainedAt = status === 'trained' ? new Date() : null;

    const result = await query(
      `UPDATE student_drill_records
       SET status = $1, level = $2, coach_notes = $3, trained_at = $4, assessed_by = $5
       WHERE id = $6
       RETURNING id, student_id, enrollment_id, curriculum_id, drill_id, week_number,
                 scheduled_start, scheduled_end, status, level, coach_notes, trained_at, assessed_by`,
      [status, level ?? null, coachNotes ?? null, trainedAt, req.user!.id, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Drill record not found' });
      return;
    }

    res.status(200).json(mapDrillRecord(result.rows[0]));
  } catch (error) {
    console.error('Update student drill record error:', error);
    res.status(500).json({ error: 'An error occurred while updating the drill record' });
  }
};

/**
 * Re-sync a student's pending drill records after their curriculum plan is edited/reordered.
 * Called from the curriculum controller, not exposed as its own route.
 */
export async function resyncDrillRecordsForPlan(
  studentId: string,
  weeks: any[],
  centerId: string | null
): Promise<void> {
  const activeEnrollment = await query(
    `SELECT id, curriculum_id FROM student_enrollments WHERE student_id = $1 AND status = 'active'`,
    [studentId]
  );
  if (activeEnrollment.rows.length === 0) return;

  const { id: enrollmentId, curriculum_id: curriculumId } = activeEnrollment.rows[0];
  await syncDrillRecordsForEnrollment(enrollmentId, studentId, curriculumId, weeks, centerId);
}

/**
 * pg parses DATE columns into a JS Date using LOCAL-time year/month/day components. Reading
 * it back with toISOString() (always UTC) can shift the calendar day by the server's UTC
 * offset, so we must re-read the same local components rather than convert to UTC.
 */
function formatDateLocal(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapEnrollment(row: any) {
  return {
    id: row.id,
    studentId: row.student_id,
    batchTimeTemplateId: row.batch_time_template_id,
    curriculumId: row.curriculum_id,
    coachId: row.coach_id,
    startDate: formatDateLocal(row.start_date),
    projectedEndDate: formatDateLocal(row.projected_end_date),
    monthlyFee: row.monthly_fee,
    status: row.status,
    isBackfilled: row.is_backfilled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrollmentWithNames(row: any) {
  return {
    ...mapEnrollment(row),
    templateName: row.template_name,
    curriculumName: row.curriculum_name,
    coachName: row.coach_name,
  };
}

function mapDrillRecord(row: any) {
  return {
    id: row.id,
    studentId: row.student_id,
    enrollmentId: row.enrollment_id,
    curriculumId: row.curriculum_id,
    curriculumName: row.curriculum_name,
    drillId: row.drill_id,
    drillName: row.drill_name,
    drillCategory: row.drill_category,
    weekNumber: row.week_number,
    scheduledStart: formatDateLocal(row.scheduled_start),
    scheduledEnd: formatDateLocal(row.scheduled_end),
    status: row.status,
    level: row.level,
    coachNotes: row.coach_notes,
    trainedAt: row.trained_at,
    assessedBy: row.assessed_by,
    coachId: row.coach_id,
    coachName: row.coach_name,
    enrollmentStatus: row.enrollment_status,
    enrollmentStartDate: formatDateLocal(row.enrollment_start_date),
  };
}
