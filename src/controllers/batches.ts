import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * POST /api/batches
 * Create a new batch
 * Requires: HEAD_COACH role
 */
export const createBatch = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, schedule, assignedCoachId } = req.body;

    const result = await query(
      `INSERT INTO batches (name, schedule, assigned_coach_id)
       VALUES ($1, $2, $3)
       RETURNING id, name, schedule, assigned_coach_id, is_archived, created_at, updated_at`,
      [name, schedule || null, assignedCoachId || null]
    );

    const batch = mapBatchRow(result.rows[0]);
    res.status(201).json(batch);
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ error: 'An error occurred while creating batch' });
  }
};

/**
 * GET /api/batches
 * List all non-archived batches with coach name
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listBatches = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT b.id, b.name, b.schedule, b.assigned_coach_id,
              u.name AS coach_name,
              b.created_at, b.updated_at
       FROM batches b
       LEFT JOIN users u ON b.assigned_coach_id = u.id
       WHERE b.is_archived = false
       ORDER BY b.name ASC`
    );

    const batches = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      schedule: row.schedule,
      assignedCoachId: row.assigned_coach_id,
      coachName: row.coach_name || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.status(200).json({ batches });
  } catch (error) {
    console.error('List batches error:', error);
    res.status(500).json({ error: 'An error occurred while fetching batches' });
  }
};

/**
 * PATCH /api/batches/:id
 * Update a batch with partial data
 * Requires: HEAD_COACH role
 */
export const updateBatch = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const allowedFields: Record<string, string> = {
      name: 'name',
      schedule: 'schedule',
      assignedCoachId: 'assigned_coach_id',
    };

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(allowedFields).forEach(([camelKey, snakeKey]) => {
      if (req.body[camelKey] !== undefined) {
        updates.push(`${snakeKey} = $${paramIndex}`);
        params.push(req.body[camelKey]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    params.push(id);

    const result = await query(
      `UPDATE batches
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND is_archived = false
       RETURNING id, name, schedule, assigned_coach_id, is_archived, created_at, updated_at`,
      params
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    const batch = mapBatchRow(result.rows[0]);
    res.status(200).json(batch);
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ error: 'An error occurred while updating batch' });
  }
};

/**
 * DELETE /api/batches/:id
 * Soft-delete (archive) a batch
 * Requires: HEAD_COACH role
 */
export const archiveBatch = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE batches SET is_archived = true
       WHERE id = $1 AND is_archived = false
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    res.status(200).json({ message: 'Batch archived successfully' });
  } catch (error) {
    console.error('Archive batch error:', error);
    res.status(500).json({ error: 'An error occurred while archiving batch' });
  }
};

/**
 * Helper to map database row to camelCase response
 */
function mapBatchRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    assignedCoachId: row.assigned_coach_id,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
