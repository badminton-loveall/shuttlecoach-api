import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';

/**
 * POST /api/batches/:batchId/students/assign
 * Assign a student to a coach within a batch
 * Requires: HEAD_COACH role
 */
export const assignStudentToCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;
    const { student_id, coach_id } = req.body;
    const centerId = req.tenantCenterId;

    // Validate required fields
    if (!student_id || !coach_id) {
      res.status(400).json({ error: 'student_id and coach_id are required' });
      return;
    }

    // Verify batch exists and belongs to the center
    const batchResult = await query(
      `SELECT id FROM batches WHERE id = $1 AND center_id = $2`,
      [batchId, centerId]
    );

    if (batchResult.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Verify student is in the batch
    const studentResult = await query(
      `SELECT id, assigned_coach_id FROM students WHERE id = $1 AND batch_id = $2`,
      [student_id, batchId]
    );

    if (studentResult.rows.length === 0) {
      res.status(404).json({ error: 'Student not found in this batch' });
      return;
    }

    // Check if student is already assigned to another coach
    const student = studentResult.rows[0];
    if (student.assigned_coach_id && student.assigned_coach_id !== coach_id) {
      res.status(409).json({
        error: 'Student already assigned to another coach. Use the move endpoint to reassign.',
      });
      return;
    }

    // Verify coach is assigned to this batch
    const coachResult = await query(
      `SELECT id FROM batch_coach_assignments WHERE batch_id = $1 AND coach_id = $2`,
      [batchId, coach_id]
    );

    if (coachResult.rows.length === 0) {
      res.status(400).json({ error: 'Coach is not assigned to this batch' });
      return;
    }

    // Assign student to coach
    await query(
      `UPDATE students SET assigned_coach_id = $1 WHERE id = $2`,
      [coach_id, student_id]
    );

    res.status(200).json({ message: 'Student assigned to coach successfully' });
  } catch (error) {
    console.error('Assign student to coach error:', error);
    res.status(500).json({ error: 'An error occurred while assigning student to coach' });
  }
};

/**
 * POST /api/batches/:batchId/students/move
 * Move a student from one coach to another within a batch
 * Requires: HEAD_COACH role
 */
export const moveStudent = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;
    const { student_id, target_coach_id } = req.body;
    const centerId = req.tenantCenterId;

    // Validate required fields
    if (!student_id || !target_coach_id) {
      res.status(400).json({ error: 'student_id and target_coach_id are required' });
      return;
    }

    // Verify batch exists and belongs to the center
    const batchResult = await query(
      `SELECT id FROM batches WHERE id = $1 AND center_id = $2`,
      [batchId, centerId]
    );

    if (batchResult.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Verify student is in the batch
    const studentResult = await query(
      `SELECT id, assigned_coach_id FROM students WHERE id = $1 AND batch_id = $2`,
      [student_id, batchId]
    );

    if (studentResult.rows.length === 0) {
      res.status(404).json({ error: 'Student not found in this batch' });
      return;
    }

    // Verify target coach is assigned to this batch
    const targetCoachResult = await query(
      `SELECT id FROM batch_coach_assignments WHERE batch_id = $1 AND coach_id = $2`,
      [batchId, target_coach_id]
    );

    if (targetCoachResult.rows.length === 0) {
      res.status(400).json({ error: 'Target coach is not assigned to this batch' });
      return;
    }

    // Move student to target coach atomically
    await query(
      `UPDATE students SET assigned_coach_id = $1 WHERE id = $2`,
      [target_coach_id, student_id]
    );

    res.status(200).json({ message: 'Student moved to new coach successfully' });
  } catch (error) {
    console.error('Move student error:', error);
    res.status(500).json({ error: 'An error occurred while moving student' });
  }
};

/**
 * GET /api/batches/:batchId/students/assignments
 * List student-coach assignments for a batch, grouped by coach
 * Unassigned students default to the head coach
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listStudentAssignments = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;
    const centerId = req.tenantCenterId;

    // Verify batch exists and belongs to the center
    const batchResult = await query(
      `SELECT id FROM batches WHERE id = $1 AND center_id = $2`,
      [batchId, centerId]
    );

    if (batchResult.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Get head coach for the batch
    const headCoachResult = await query(
      `SELECT coach_id FROM batch_coach_assignments WHERE batch_id = $1 AND role = 'head_coach'`,
      [batchId]
    );

    const headCoachId = headCoachResult.rows.length > 0 ? headCoachResult.rows[0].coach_id : null;

    // Get all students in the batch with their coach assignments
    const studentsResult = await query(
      `SELECT s.id AS student_id, s.name AS student_name, s.assigned_coach_id,
              u.name AS coach_name
       FROM students s
       LEFT JOIN users u ON u.id = s.assigned_coach_id
       WHERE s.batch_id = $1
       ORDER BY s.name`,
      [batchId]
    );

    // Get all coach assignments for this batch
    const coachesResult = await query(
      `SELECT bca.coach_id, bca.role, u.name AS coach_name
       FROM batch_coach_assignments bca
       JOIN users u ON u.id = bca.coach_id
       WHERE bca.batch_id = $1
       ORDER BY bca.role, u.name`,
      [batchId]
    );

    // Group students by coach
    const assignments: Record<string, { coach_id: string; coach_name: string; role: string; students: Array<{ student_id: string; student_name: string }> }> = {};

    // Initialize coach groups
    for (const coach of coachesResult.rows) {
      assignments[coach.coach_id] = {
        coach_id: coach.coach_id,
        coach_name: coach.coach_name,
        role: coach.role,
        students: [],
      };
    }

    // Assign students to their coaches (unassigned default to head coach)
    for (const student of studentsResult.rows) {
      const assignedTo = student.assigned_coach_id || headCoachId;
      if (assignedTo && assignments[assignedTo]) {
        assignments[assignedTo].students.push({
          student_id: student.student_id,
          student_name: student.student_name,
        });
      }
    }

    res.status(200).json({
      batch_id: batchId,
      head_coach_id: headCoachId,
      assignments: Object.values(assignments),
    });
  } catch (error) {
    console.error('List student assignments error:', error);
    res.status(500).json({ error: 'An error occurred while listing student assignments' });
  }
};
