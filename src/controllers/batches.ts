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
    const { name, schedule, assignedCoachId, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description } = req.body;
    const coachId = assignedCoachId || assigned_coach_id || null;

    const result = await query(
      `INSERT INTO batches (name, schedule, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, schedule, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description, is_archived, created_at, updated_at`,
      [name, schedule || null, coachId, capacity || null, skill_level || null, monthly_fee || null, days_of_week || null, start_time || null, end_time || null, description || null]
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
              b.capacity, b.skill_level, b.monthly_fee, b.days_of_week,
              b.start_time, b.end_time, b.description,
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
      assigned_coach_id: row.assigned_coach_id,
      coach_name: row.coach_name || null,
      capacity: row.capacity || null,
      skill_level: row.skill_level || null,
      monthly_fee: row.monthly_fee ? Number(row.monthly_fee) : null,
      days_of_week: row.days_of_week || null,
      start_time: row.start_time || null,
      end_time: row.end_time || null,
      description: row.description || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
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

    // Map of request body keys to database column names
    const allowedFields: Record<string, string> = {
      name: 'name',
      schedule: 'schedule',
      assignedCoachId: 'assigned_coach_id',
      assigned_coach_id: 'assigned_coach_id',
      capacity: 'capacity',
      skill_level: 'skill_level',
      monthly_fee: 'monthly_fee',
      days_of_week: 'days_of_week',
      start_time: 'start_time',
      end_time: 'end_time',
      description: 'description',
    };

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(allowedFields).forEach(([bodyKey, snakeKey]) => {
      if (req.body[bodyKey] !== undefined) {
        // Avoid duplicating assigned_coach_id if both camel and snake are present
        if (snakeKey === 'assigned_coach_id' && updates.some(u => u.startsWith('assigned_coach_id'))) {
          return;
        }
        updates.push(`${snakeKey} = $${paramIndex}`);
        params.push(req.body[bodyKey] || null);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    params.push(id);

    const result = await query(
      `UPDATE batches
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND is_archived = false
       RETURNING id, name, schedule, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description, is_archived, created_at, updated_at`,
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
 * Helper to map database row to response format
 */
function mapBatchRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    schedule: row.schedule,
    assigned_coach_id: row.assigned_coach_id,
    capacity: row.capacity || null,
    skill_level: row.skill_level || null,
    monthly_fee: row.monthly_fee ? Number(row.monthly_fee) : null,
    days_of_week: row.days_of_week || null,
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    description: row.description || null,
    is_archived: row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
