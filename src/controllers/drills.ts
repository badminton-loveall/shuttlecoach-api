import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';

/**
 * POST /api/drills
 * Create a new drill
 * Requires: HEAD_COACH role
 */
export const createDrill = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, category } = req.body;

    const result = await query(
      `INSERT INTO drills (name, description, category, center_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, category, is_archived, created_at, updated_at`,
      [name, description, category, req.tenantCenterId || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create drill error:', error);
    res.status(500).json({
      error: 'An error occurred while creating drill',
    });
  }
};

/**
 * GET /api/drills
 * List non-archived drills with optional category filter and name search
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listDrills = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { category, search } = req.query;
    const conditions: string[] = ['is_archived = false'];
    const params: any[] = [];
    let paramIndex = 1;

    // Tenant scoping: filter by center_id if set
    if (req.tenantCenterId) {
      conditions.push(`center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (search) {
      conditions.push(`name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT id, name, description, category, created_at, updated_at
       FROM drills
       WHERE ${conditions.join(' AND ')}
       ORDER BY category, name`,
      params
    );

    res.status(200).json({ drills: result.rows });
  } catch (error) {
    console.error('List drills error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching drills',
    });
  }
};

/**
 * PATCH /api/drills/:id
 * Update a drill with partial data
 * Requires: HEAD_COACH role
 */
export const updateDrill = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const allowedFields: Record<string, string> = {
      name: 'name',
      description: 'description',
      category: 'category',
    };

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(allowedFields).forEach(([bodyKey, dbColumn]) => {
      if (req.body[bodyKey] !== undefined) {
        updates.push(`${dbColumn} = $${paramIndex}`);
        params.push(req.body[bodyKey]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

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
      `UPDATE drills
       SET ${updates.join(', ')}
       WHERE ${whereConditions.join(' AND ')}
       RETURNING id, name, description, category, is_archived, created_at, updated_at`,
      params
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Drill not found' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update drill error:', error);
    res.status(500).json({
      error: 'An error occurred while updating drill',
    });
  }
};

/**
 * DELETE /api/drills/:id
 * Archive a drill (soft-delete)
 * Requires: HEAD_COACH role
 */
export const archiveDrill = async (
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
      `UPDATE drills SET is_archived = true
       WHERE ${conditions.join(' AND ')}
       RETURNING id`,
      params
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Drill not found' });
      return;
    }

    res.status(200).json({ message: 'Drill archived successfully' });
  } catch (error) {
    console.error('Archive drill error:', error);
    res.status(500).json({
      error: 'An error occurred while archiving drill',
    });
  }
};
