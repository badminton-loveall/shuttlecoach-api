import { query } from '../config/database';
import {
  LeaveRequest,
  LeaveRequestStatus,
  CreateLeaveRequestBody,
  GetLeaveRequestsQuery,
} from '../types';

/**
 * LeaveService - Manages student leave requests, approvals, and
 * pre-population of attendance records for approved leave dates.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

// ============================================================================
// Helper: Map database row to camelCase LeaveRequest
// ============================================================================

function mapLeaveRequestRow(row: any): LeaveRequest {
  return {
    id: row.id,
    studentId: row.student_id,
    batchId: row.batch_id,
    requestedDate: row.requested_date,
    leaveType: row.leave_type,
    reason: row.reason || undefined,
    status: row.status,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

// ============================================================================
// createLeaveRequest
// ============================================================================

/**
 * Create a new leave request for a student.
 *
 * Validates:
 * - requestedDate must be strictly in the future (not today, not past)
 * - leaveType must be PLANNED_LEAVE or SICK_LEAVE (enforced by schema + DB)
 * - Duplicate check: same student + same date returns 409
 *
 * Requirements: 3.1, 3.2
 */
export async function createLeaveRequest(
  body: CreateLeaveRequestBody & { centerId?: string }
): Promise<{ leaveRequest: LeaveRequest } | { error: string; status: number }> {
  const { studentId, batchId, requestedDate, leaveType, reason, centerId } = body;

  // --- Future-date validation (strict: must be after today) ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const requested = new Date(requestedDate + 'T00:00:00');

  if (requested.getTime() <= today.getTime()) {
    return {
      error: 'Leave requests can only be submitted for future dates',
      status: 400,
    };
  }

  // --- Duplicate check: same student + same date ---
  const duplicateCheck = await query(
    `SELECT id FROM leave_requests
     WHERE student_id = $1 AND requested_date = $2
     AND status != 'REJECTED'`,
    [studentId, requestedDate]
  );

  if (duplicateCheck.rows.length > 0) {
    return {
      error: 'A leave request already exists for this student on the requested date',
      status: 409,
    };
  }

  // --- Insert the leave request ---
  const result = await query(
    `INSERT INTO leave_requests (student_id, batch_id, requested_date, leave_type, reason, center_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [studentId, batchId, requestedDate, leaveType, reason || null, centerId || null]
  );

  return { leaveRequest: mapLeaveRequestRow(result.rows[0]) };
}

// ============================================================================
// getLeaveRequests
// ============================================================================

/**
 * Retrieve leave requests with optional filters.
 * Supports filtering by batch_id, student_id, status, and center_id.
 *
 * Requirements: 3.3
 */
export async function getLeaveRequests(
  filters: GetLeaveRequestsQuery & { centerId?: string }
): Promise<LeaveRequest[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Tenant scoping: filter by center_id
  if (filters.centerId) {
    conditions.push(`lr.center_id = $${paramIndex}`);
    params.push(filters.centerId);
    paramIndex++;
  }

  if (filters.batchId) {
    conditions.push(`lr.batch_id = $${paramIndex}`);
    params.push(filters.batchId);
    paramIndex++;
  }

  if (filters.studentId) {
    conditions.push(`lr.student_id = $${paramIndex}`);
    params.push(filters.studentId);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`lr.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT lr.*
     FROM leave_requests lr
     ${whereClause}
     ORDER BY lr.requested_date DESC, lr.created_at DESC`,
    params
  );

  return result.rows.map(mapLeaveRequestRow);
}

// ============================================================================
// reviewLeaveRequest
// ============================================================================

/**
 * Approve or reject a leave request.
 * Updates status, records reviewedBy and reviewedAt.
 * If approved, pre-populates an attendance record for the requested date.
 *
 * Requirements: 3.4, 3.5
 */
export async function reviewLeaveRequest(
  id: string,
  status: Exclude<LeaveRequestStatus, 'PENDING'>,
  reviewedBy: string,
  centerId?: string
): Promise<{ leaveRequest: LeaveRequest } | { error: string; status: number }> {
  // --- Fetch the existing leave request (with tenant scoping) ---
  let existing;
  if (centerId) {
    existing = await query(
      `SELECT * FROM leave_requests WHERE id = $1 AND center_id = $2`,
      [id, centerId]
    );
  } else {
    existing = await query(
      `SELECT * FROM leave_requests WHERE id = $1`,
      [id]
    );
  }

  if (existing.rows.length === 0) {
    return { error: 'Leave request not found', status: 404 };
  }

  const leaveReq = existing.rows[0];

  // --- Only PENDING requests can be reviewed ---
  if (leaveReq.status !== 'PENDING') {
    return {
      error: `Leave request has already been ${leaveReq.status.toLowerCase()}`,
      status: 400,
    };
  }

  // --- Update the leave request ---
  const result = await query(
    `UPDATE leave_requests
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [status, reviewedBy, id]
  );

  const updated = mapLeaveRequestRow(result.rows[0]);

  // --- If APPROVED, pre-populate attendance record ---
  if (status === 'APPROVED') {
    await prePopulateAttendanceForApprovedLeave(
      leaveReq.student_id,
      leaveReq.batch_id,
      leaveReq.requested_date,
      reviewedBy
    );
  }

  return { leaveRequest: updated };
}

// ============================================================================
// prePopulateAttendanceForApprovedLeave
// ============================================================================

/**
 * When a leave request is approved, create (or update) an attendance record
 * for that student on the requested date with status=ABSENT and
 * leaveType=PLANNED_LEAVE.
 *
 * Uses upsert to avoid conflicts if the attendance record already exists.
 *
 * Requirements: 3.5
 */
export async function prePopulateAttendanceForApprovedLeave(
  studentId: string,
  batchId: string,
  requestedDate: string,
  markedBy: string
): Promise<void> {
  await query(
    `INSERT INTO attendance_records (student_id, batch_id, session_date, status, leave_type, marked_by)
     VALUES ($1, $2, $3, 'ABSENT', 'PLANNED_LEAVE', $4)
     ON CONFLICT (student_id, batch_id, session_date)
     DO UPDATE SET status = 'ABSENT', leave_type = 'PLANNED_LEAVE', marked_by = $4`,
    [studentId, batchId, requestedDate, markedBy]
  );
}
