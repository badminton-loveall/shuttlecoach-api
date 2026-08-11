import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';

/**
 * POST /api/batches
 * Create a new batch
 * Requires: HEAD_COACH role
 */
export const createBatch = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, schedule, assignedCoachId, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description, curriculum_id } = req.body;
    const coachId = assignedCoachId || assigned_coach_id || null;

    const result = await query(
      `INSERT INTO batches (name, schedule, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description, center_id, curriculum_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, name, schedule, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description, template_id, curriculum_id, is_archived, created_at, updated_at`,
      [name, schedule || null, coachId, capacity || null, skill_level || null, monthly_fee || null, days_of_week || null, start_time || null, end_time || null, description || null, req.tenantCenterId || null, curriculum_id || null]
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
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    // Build WHERE clause with tenant scoping
    const conditions: string[] = ['b.is_archived = false'];
    const params: any[] = [];
    let paramIndex = 1;

    if (req.tenantCenterId) {
      conditions.push(`b.center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const result = await query(
      `SELECT b.id, b.name, b.schedule, b.assigned_coach_id,
              u.name AS coach_name,
              u.role AS coach_role,
              t.name AS template_name,
              c.name AS curriculum_name,
              b.curriculum_id,
              b.capacity, b.skill_level, b.monthly_fee, b.days_of_week,
              b.start_time, b.end_time, b.description, b.template_id,
              b.created_at, b.updated_at,
              COUNT(s.id) AS student_count
       FROM batches b
       LEFT JOIN users u ON b.assigned_coach_id = u.id
       LEFT JOIN batch_time_templates t ON b.template_id = t.id
       LEFT JOIN courses c ON b.curriculum_id = c.id
       LEFT JOIN students s ON s.batch_id = b.id AND s.status != 'archived'
       ${whereClause}
       GROUP BY b.id, b.name, b.schedule, b.assigned_coach_id, u.name, u.role,
                t.name, c.name, b.curriculum_id,
                b.capacity, b.skill_level, b.monthly_fee, b.days_of_week,
                b.start_time, b.end_time, b.description, b.template_id,
                b.created_at, b.updated_at
       ORDER BY b.name ASC`,
      params
    );

    const batches = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      schedule: row.schedule,
      assigned_coach_id: row.assigned_coach_id,
      coach_name: row.coach_name || null,
      coach_role: row.coach_role || null,
      template_name: row.template_name || null,
      curriculum_id: row.curriculum_id || null,
      curriculum_name: row.curriculum_name || null,
      capacity: row.capacity || null,
      skill_level: row.skill_level || null,
      monthly_fee: row.monthly_fee ? Number(row.monthly_fee) : null,
      days_of_week: row.days_of_week || null,
      start_time: row.start_time || null,
      end_time: row.end_time || null,
      description: row.description || null,
      template_id: row.template_id || null,
      student_count: parseInt(row.student_count, 10) || 0,
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
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate template_id if provided and non-null
    if (req.body.template_id !== undefined && req.body.template_id !== null) {
      const templateResult = await query(
        `SELECT id, center_id, is_archived FROM batch_time_templates WHERE id = $1`,
        [req.body.template_id]
      );

      if (templateResult.rowCount === 0) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      const template = templateResult.rows[0];

      if (template.is_archived) {
        res.status(400).json({ error: 'Cannot assign an archived template' });
        return;
      }

      if (req.tenantCenterId && template.center_id !== req.tenantCenterId) {
        res.status(400).json({ error: 'Template does not belong to this center' });
        return;
      }
    }

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
      template_id: 'template_id',
      curriculum_id: 'curriculum_id',
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

    // Build WHERE clause with tenant scoping
    const whereConditions = [`id = $${paramIndex}`, 'is_archived = false'];
    paramIndex++;

    if (req.tenantCenterId) {
      whereConditions.push(`center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    const result = await query(
      `UPDATE batches
       SET ${updates.join(', ')}
       WHERE ${whereConditions.join(' AND ')}
       RETURNING id, name, schedule, assigned_coach_id, capacity, skill_level, monthly_fee, days_of_week, start_time, end_time, description, template_id, is_archived, created_at, updated_at`,
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
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Build WHERE clause with tenant scoping
    const conditions = ['id = $1', 'is_archived = false'];
    const params: any[] = [id];

    if (req.tenantCenterId) {
      conditions.push('center_id = $2');
      params.push(req.tenantCenterId);
    }

    const result = await query(
      `UPDATE batches SET is_archived = true
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      params
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
    template_id: row.template_id || null,
    is_archived: row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
