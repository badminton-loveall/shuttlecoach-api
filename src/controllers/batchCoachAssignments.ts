import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';

/**
 * GET /api/batches/:batchId/coaches
 * List all coach assignments for a batch
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listBatchCoaches = async (
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

    // Fetch coach assignments with user info
    const result = await query(
      `SELECT bca.id, bca.batch_id, bca.coach_id, bca.role, bca.created_at,
              u.name AS coach_name, u.email AS coach_email
       FROM batch_coach_assignments bca
       JOIN users u ON u.id = bca.coach_id
       WHERE bca.batch_id = $1
       ORDER BY bca.role, u.name`,
      [batchId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('List batch coaches error:', error);
    res.status(500).json({ error: 'An error occurred while listing batch coaches' });
  }
};

/**
 * POST /api/batches/:batchId/coaches
 * Assign a coach to a batch
 * Requires: HEAD_COACH role
 */
export const assignCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { batchId } = req.params;
    const { coach_id, role } = req.body;
    const centerId = req.tenantCenterId;

    // Validate role
    if (!role || !['head_coach', 'assistant_coach'].includes(role)) {
      res.status(400).json({ error: 'Role must be head_coach or assistant_coach' });
      return;
    }

    // Validate coach_id is provided
    if (!coach_id) {
      res.status(400).json({ error: 'coach_id is required' });
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

    // If assigning head_coach, check that no head_coach already exists
    if (role === 'head_coach') {
      const existingHead = await query(
        `SELECT id FROM batch_coach_assignments WHERE batch_id = $1 AND role = 'head_coach'`,
        [batchId]
      );

      if (existingHead.rows.length > 0) {
        res.status(409).json({ error: 'Batch already has a head coach. Remove the existing head coach first.' });
        return;
      }
    }

    // Check if coach is already assigned to this batch
    const existingAssignment = await query(
      `SELECT id FROM batch_coach_assignments WHERE batch_id = $1 AND coach_id = $2`,
      [batchId, coach_id]
    );

    if (existingAssignment.rows.length > 0) {
      res.status(409).json({ error: 'Coach is already assigned to this batch' });
      return;
    }

    // Insert assignment
    const result = await query(
      `INSERT INTO batch_coach_assignments (batch_id, coach_id, role)
       VALUES ($1, $2, $3)
       RETURNING id, batch_id, coach_id, role, created_at`,
      [batchId, coach_id, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Assign coach error:', error);
    res.status(500).json({ error: 'An error occurred while assigning coach' });
  }
};

/**
 * DELETE /api/batches/:batchId/coaches/:coachId
 * Remove a coach from a batch
 * If removing an assistant coach, reassigns their students to the head coach
 * Requires: HEAD_COACH role
 */
export const removeCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { batchId, coachId } = req.params;
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

    // Find the assignment
    const assignmentResult = await query(
      `SELECT id, role FROM batch_coach_assignments WHERE batch_id = $1 AND coach_id = $2`,
      [batchId, coachId]
    );

    if (assignmentResult.rows.length === 0) {
      res.status(404).json({ error: 'Coach assignment not found' });
      return;
    }

    const assignment = assignmentResult.rows[0];

    // Prevent removing head coach if batch still has students or other coaches
    if (assignment.role === 'head_coach') {
      const otherCoaches = await query(
        `SELECT id FROM batch_coach_assignments WHERE batch_id = $1 AND role = 'assistant_coach'`,
        [batchId]
      );

      if (otherCoaches.rows.length > 0) {
        res.status(400).json({
          error: 'Cannot remove head coach while assistant coaches are assigned. Remove assistant coaches first.',
        });
        return;
      }
    }

    // If removing assistant coach, reassign their students to the head coach
    if (assignment.role === 'assistant_coach') {
      const headCoachResult = await query(
        `SELECT coach_id FROM batch_coach_assignments WHERE batch_id = $1 AND role = 'head_coach'`,
        [batchId]
      );

      if (headCoachResult.rows.length > 0) {
        const headCoachId = headCoachResult.rows[0].coach_id;
        // Reassign students from this assistant coach to the head coach
        await query(
          `UPDATE students SET assigned_coach_id = $1 WHERE assigned_coach_id = $2 AND batch_id = $3`,
          [headCoachId, coachId, batchId]
        );
      } else {
        // No head coach, just clear assignments
        await query(
          `UPDATE students SET assigned_coach_id = NULL WHERE assigned_coach_id = $1 AND batch_id = $2`,
          [coachId, batchId]
        );
      }
    }

    // Delete the assignment
    await query(
      `DELETE FROM batch_coach_assignments WHERE id = $1`,
      [assignment.id]
    );

    res.status(200).json({ message: 'Coach removed from batch successfully' });
  } catch (error) {
    console.error('Remove coach error:', error);
    res.status(500).json({ error: 'An error occurred while removing coach' });
  }
};
