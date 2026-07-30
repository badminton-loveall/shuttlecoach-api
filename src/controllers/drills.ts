import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * POST /api/drills
 * Create a new drill
 * Requires: HEAD_COACH role
 */
export const createDrill = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, category } = req.body;

    const result = await query(
      `INSERT INTO drills (name, description, category)
       VALUES ($1, $2, $3)
       RETURNING id, name, description, category, is_archived, created_at, updated_at`,
      [name, description, category]
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
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { category, search } = req.query;
    const conditions: string[] = ['is_archived = false'];
    const params: any[] = [];
    let paramIndex = 1;

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
  req: AuthRequest,
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

    const result = await query(
      `UPDATE drills
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND is_archived = false
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
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE drills SET is_archived = true
       WHERE id = $1 AND is_archived = false
       RETURNING id`,
      [id]
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
