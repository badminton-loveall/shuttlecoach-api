import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

/**
 * GET /api/admin/drills
 * List global drills (center_id IS NULL, not archived)
 * Supports optional filters: sport, category, search (name ILIKE)
 */
export const listGlobalDrills = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { sport, category, search } = req.query;
    const conditions: string[] = ['center_id IS NULL', 'is_archived = false'];
    const params: any[] = [];
    let paramIndex = 1;

    if (sport) {
      conditions.push(`sport = $${paramIndex}`);
      params.push(sport);
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
      `SELECT id, name, description, category, sport, is_archived, video_url, created_at, updated_at
       FROM drills
       WHERE ${conditions.join(' AND ')}
       ORDER BY category, name`,
      params
    );

    const drills = result.rows.map(({ video_url, ...row }) => ({ ...row, videoUrl: video_url }));
    res.status(200).json({ drills });
  } catch (error) {
    console.error('List global drills error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching global drills',
    });
  }
};

/**
 * POST /api/admin/drills
 * Create a new global drill (center_id = NULL)
 */
export const createGlobalDrill = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, category, sport, videoUrl } = req.body;

    const result = await query(
      `INSERT INTO drills (name, description, category, sport, center_id, video_url)
       VALUES ($1, $2, $3, $4, NULL, $5)
       RETURNING id, name, description, category, sport, center_id, is_archived, video_url, created_at, updated_at`,
      [name, description, category, sport, videoUrl || null]
    );

    const { video_url, ...rest } = result.rows[0];
    res.status(201).json({ ...rest, videoUrl: video_url });
  } catch (error) {
    console.error('Create global drill error:', error);
    res.status(500).json({
      error: 'An error occurred while creating global drill',
    });
  }
};

/**
 * PATCH /api/admin/drills/:id
 * Update a global drill (only if center_id IS NULL)
 * Supports partial updates: name, description, category, sport
 */
export const updateGlobalDrill = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const allowedFields: Record<string, string> = {
      name: 'name',
      description: 'description',
      category: 'category',
      sport: 'sport',
      videoUrl: 'video_url',
    };

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(allowedFields).forEach(([bodyKey, dbColumn]) => {
      if (req.body[bodyKey] !== undefined) {
        updates.push(`${dbColumn} = $${paramIndex}`);
        params.push(bodyKey === 'videoUrl' ? (req.body[bodyKey] || null) : req.body[bodyKey]);
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
       WHERE id = $${paramIndex} AND center_id IS NULL AND is_archived = false
       RETURNING id, name, description, category, sport, center_id, is_archived, video_url, created_at, updated_at`,
      params
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Global drill not found' });
      return;
    }

    const { video_url, ...rest } = result.rows[0];
    res.status(200).json({ ...rest, videoUrl: video_url });
  } catch (error) {
    console.error('Update global drill error:', error);
    res.status(500).json({
      error: 'An error occurred while updating global drill',
    });
  }
};

/**
 * DELETE /api/admin/drills/:id
 * Archive a global drill (soft-delete, only if center_id IS NULL)
 */
export const archiveGlobalDrill = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE drills SET is_archived = true
       WHERE id = $1 AND center_id IS NULL AND is_archived = false
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Global drill not found' });
      return;
    }

    res.status(200).json({ message: 'Global drill archived successfully' });
  } catch (error) {
    console.error('Archive global drill error:', error);
    res.status(500).json({
      error: 'An error occurred while archiving global drill',
    });
  }
};
