import { query } from '../config/database';
import {
  AttendanceRecord,
  AttendanceStats,
  AttendanceStatus,
  LeaveType,
  MarkAttendanceRequestRecord,
  GetAttendanceQuery,
  GetAttendanceStatsQuery,
} from '../types';

// ============================================================
// Date Validation
// ============================================================

/**
 * Validates that a session date is not more than 7 days in the past.
 * Returns an error message if invalid, or null if valid.
 */
export function validateSessionDate(sessionDate: string): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(sessionDate + 'T00:00:00');
  if (isNaN(date.getTime())) {
    return 'Invalid date format';
  }

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (date < sevenDaysAgo) {
    return 'Cannot mark attendance for dates more than 7 days in the past';
  }

  return null;
}

// ============================================================
// Mark Attendance (Upsert)
// ============================================================

export interface MarkAttendanceResult {
  success: boolean;
  recordCount: number;
}

/**
 * Marks attendance for a batch on a given date using upsert semantics.
 * ON CONFLICT(student_id, batch_id, session_date) UPDATE ensures idempotent submissions.
 */
export async function markAttendance(
  batchId: string,
  sessionDate: string,
  records: MarkAttendanceRequestRecord[],
  markedBy: string,
  centerId?: string
): Promise<MarkAttendanceResult> {
  // Validate session date (7-day window)
  const dateError = validateSessionDate(sessionDate);
  if (dateError) {
    throw new Error(dateError);
  }

  // Validate batch exists (with tenant scoping) and get its center_id
  let batchCheck;
  if (centerId) {
    batchCheck = await query(
      'SELECT id, center_id FROM batches WHERE id = $1 AND is_archived = false AND center_id = $2',
      [batchId, centerId]
    );
  } else {
    batchCheck = await query(
      'SELECT id, center_id FROM batches WHERE id = $1 AND is_archived = false',
      [batchId]
    );
  }
  if (batchCheck.rows.length === 0) {
    throw new Error('Batch not found');
  }

  // Use the batch's center_id for the attendance record (guaranteed NOT NULL)
  const resolvedCenterId: string = batchCheck.rows[0].center_id;

  // Upsert each attendance record
  let upsertedCount = 0;

  for (const record of records) {
    await query(
      `INSERT INTO attendance_records (student_id, batch_id, session_date, status, leave_type, marked_by, center_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (student_id, batch_id, session_date)
       DO UPDATE SET
         status = EXCLUDED.status,
         leave_type = EXCLUDED.leave_type,
         marked_by = EXCLUDED.marked_by,
         updated_at = NOW()`,
      [
        record.studentId,
        batchId,
        sessionDate,
        record.status,
        record.leaveType || null,
        markedBy,
        resolvedCenterId,
      ]
    );
    upsertedCount++;
  }

  return { success: true, recordCount: upsertedCount };
}

// ============================================================
// Get Attendance Records
// ============================================================

/**
 * Retrieves attendance records with optional filters for batch_id, student_id,
 * start_date, end_date, and center_id (tenant scoping).
 */
export async function getAttendanceRecords(
  filters: GetAttendanceQuery & { centerId?: string }
): Promise<AttendanceRecord[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Tenant scoping: filter by center_id via the batches table
  if (filters.centerId) {
    conditions.push(`ar.batch_id IN (SELECT id FROM batches WHERE center_id = $${paramIndex})`);
    params.push(filters.centerId);
    paramIndex++;
  }

  if (filters.batchId) {
    conditions.push(`ar.batch_id = $${paramIndex}`);
    params.push(filters.batchId);
    paramIndex++;
  }

  if (filters.studentId) {
    conditions.push(`ar.student_id = $${paramIndex}`);
    params.push(filters.studentId);
    paramIndex++;
  }

  if (filters.startDate) {
    conditions.push(`ar.session_date >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`ar.session_date <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       ar.id, ar.student_id, ar.batch_id, ar.session_date,
       ar.status, ar.leave_type, ar.marked_by,
       ar.created_at, ar.updated_at
     FROM attendance_records ar
     ${whereClause}
     ORDER BY ar.session_date DESC, ar.student_id ASC`,
    params
  );

  return result.rows.map(mapAttendanceRow);
}

// ============================================================
// Get Attendance Stats
// ============================================================

/**
 * Computes attendance statistics per student for a batch within an optional date range.
 * Attendance percentage = (PRESENT + LATE) / totalSessions * 100, rounded to 1 decimal.
 * Enforces a maximum 6-month date range for performance.
 */
export async function getAttendanceStats(
  filters: GetAttendanceStatsQuery & { centerId?: string }
): Promise<AttendanceStats[]> {
  // Enforce 6-month maximum date range
  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months in ms
    if (end.getTime() - start.getTime() > sixMonthsMs) {
      throw new Error('Date range cannot exceed 6 months');
    }
  }

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Tenant scoping: filter by center_id via the batches table
  if (filters.centerId) {
    conditions.push(`ar.batch_id IN (SELECT id FROM batches WHERE center_id = $${paramIndex})`);
    params.push(filters.centerId);
    paramIndex++;
  }

  if (filters.batchId) {
    conditions.push(`ar.batch_id = $${paramIndex}`);
    params.push(filters.batchId);
    paramIndex++;
  }

  if (filters.studentId) {
    conditions.push(`ar.student_id = $${paramIndex}`);
    params.push(filters.studentId);
    paramIndex++;
  }

  if (filters.startDate) {
    conditions.push(`ar.session_date >= $${paramIndex}`);
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    conditions.push(`ar.session_date <= $${paramIndex}`);
    params.push(filters.endDate);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

  const result = await query(
    `SELECT
       ar.student_id,
       s.full_name AS student_name,
       COUNT(*) AS total_sessions,
       COUNT(*) FILTER (WHERE ar.status = 'PRESENT') AS attended,
       COUNT(*) FILTER (WHERE ar.status = 'LATE') AS late,
       COUNT(*) FILTER (WHERE ar.status = 'ABSENT') AS absent
     FROM attendance_records ar
     JOIN students s ON ar.student_id = s.id
     WHERE ${whereClause}
     GROUP BY ar.student_id, s.full_name
     ORDER BY s.full_name ASC`,
    params
  );

  return result.rows.map((row: any) => {
    const totalSessions = parseInt(row.total_sessions, 10);
    const attended = parseInt(row.attended, 10);
    const late = parseInt(row.late, 10);
    const absent = parseInt(row.absent, 10);

    // Attendance percentage = (PRESENT + LATE) / total * 100
    const attendancePercentage =
      totalSessions > 0
        ? Math.round(((attended + late) / totalSessions) * 1000) / 10
        : 0;

    return {
      studentId: row.student_id,
      studentName: row.student_name,
      totalSessions,
      attended,
      late,
      absent,
      attendancePercentage,
    };
  });
}

// ============================================================
// Consecutive No-Show Detection
// ============================================================

export interface NoShowFlag {
  studentId: string;
  consecutiveNoShows: number;
  latestDate: string;
}

/**
 * Detects students with 3+ consecutive NO_SHOW entries in a batch.
 * Returns an array of flagged students with their consecutive no-show count.
 */
export async function detectConsecutiveNoShows(
  batchId: string
): Promise<NoShowFlag[]> {
  // Get all attendance records for the batch, ordered by student and date
  const result = await query(
    `SELECT student_id, session_date, leave_type
     FROM attendance_records
     WHERE batch_id = $1
     ORDER BY student_id ASC, session_date ASC`,
    [batchId]
  );

  const flagged: NoShowFlag[] = [];
  let currentStudentId: string | null = null;
  let consecutiveCount = 0;
  let latestNoShowDate = '';

  for (const row of result.rows) {
    if (row.student_id !== currentStudentId) {
      // Check if previous student was flagged
      if (currentStudentId && consecutiveCount >= 3) {
        flagged.push({
          studentId: currentStudentId,
          consecutiveNoShows: consecutiveCount,
          latestDate: latestNoShowDate,
        });
      }
      // Reset for new student
      currentStudentId = row.student_id;
      consecutiveCount = 0;
      latestNoShowDate = '';
    }

    if (row.leave_type === 'NO_SHOW') {
      consecutiveCount++;
      latestNoShowDate = row.session_date;
    } else {
      // If we had a streak of 3+ before this break, flag it
      if (consecutiveCount >= 3) {
        flagged.push({
          studentId: currentStudentId!,
          consecutiveNoShows: consecutiveCount,
          latestDate: latestNoShowDate,
        });
      }
      consecutiveCount = 0;
      latestNoShowDate = '';
    }
  }

  // Check the last student
  if (currentStudentId && consecutiveCount >= 3) {
    flagged.push({
      studentId: currentStudentId,
      consecutiveNoShows: consecutiveCount,
      latestDate: latestNoShowDate,
    });
  }

  return flagged;
}

/**
 * Checks if a specific student has 3+ consecutive NO_SHOW entries (most recent).
 * Returns true if the student should be flagged for review.
 */
export async function isStudentFlaggedForNoShow(
  studentId: string,
  batchId: string
): Promise<boolean> {
  const result = await query(
    `SELECT leave_type
     FROM attendance_records
     WHERE student_id = $1 AND batch_id = $2
     ORDER BY session_date DESC`,
    [studentId, batchId]
  );

  let consecutiveCount = 0;
  for (const row of result.rows) {
    if (row.leave_type === 'NO_SHOW') {
      consecutiveCount++;
    } else {
      break; // Streak broken
    }
  }

  return consecutiveCount >= 3;
}

// ============================================================
// Helpers
// ============================================================

function mapAttendanceRow(row: any): AttendanceRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    batchId: row.batch_id,
    sessionDate: row.session_date instanceof Date
      ? row.session_date.toISOString().split('T')[0]
      : row.session_date,
    status: row.status as AttendanceStatus,
    leaveType: row.leave_type as LeaveType | undefined,
    markedBy: row.marked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
