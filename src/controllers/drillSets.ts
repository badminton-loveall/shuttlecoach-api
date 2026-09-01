import { Response } from 'express';
import { query, Pool } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';

function mapSetRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sport: row.sport,
    centerId: row.center_id,
    createdBy: row.created_by,
    status: row.status,
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    sourceSetId: row.source_set_id,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.drill_count !== undefined ? { drillCount: Number(row.drill_count) } : {}),
    ...(row.center_name !== undefined ? { centerName: row.center_name } : {}),
    ...(row.coach_name !== undefined ? { coachName: row.coach_name } : {}),
  };
}

function mapDrillRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    sport: row.sport,
  };
}

/**
 * Loads the full nested structure (categories -> drills) for a set.
 */
async function loadSetCategories(setId: string | string[]) {
  const categoriesResult = await query(
    `SELECT * FROM drill_set_categories WHERE set_id = $1 ORDER BY sort_order, created_at`,
    [setId]
  );

  const itemsResult = await query(
    `SELECT dscd.set_category_id, d.* FROM drill_set_category_drills dscd
     JOIN drill_set_categories dsc ON dsc.id = dscd.set_category_id
     JOIN drills d ON d.id = dscd.drill_id
     WHERE dsc.set_id = $1
     ORDER BY d.category, d.name`,
    [setId]
  );

  const drillsByCategory = new Map<string, any[]>();
  for (const row of itemsResult.rows) {
    const list = drillsByCategory.get(row.set_category_id) || [];
    list.push(mapDrillRow(row));
    drillsByCategory.set(row.set_category_id, list);
  }

  return categoriesResult.rows.map((row) => ({
    id: row.id,
    setId: row.set_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    drills: drillsByCategory.get(row.id) || [],
  }));
}

/**
 * POST /api/drill-sets
 * Create a new draft set owned by the requesting coach.
 * Requires: HEAD_COACH or ASSISTANT_COACH
 */
export const createSet = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { name, description, sport } = req.body;
    const centerId = req.tenantCenterId;
    const userId = req.user!.id;

    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    const result = await query(
      `INSERT INTO drill_sets (name, description, sport, center_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description || null, sport || null, centerId, userId]
    );

    res.status(201).json(mapSetRow(result.rows[0]));
  } catch (error) {
    console.error('Create drill set error:', error);
    res.status(500).json({ error: 'An error occurred while creating the set' });
  }
};

/**
 * GET /api/drill-sets
 * List the requesting coach's own sets, optionally filtered by status.
 * Requires: HEAD_COACH or ASSISTANT_COACH
 */
export const listOwnSets = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;
    const userId = req.user!.id;
    const { status } = req.query;

    const conditions = ['ds.center_id = $1', 'ds.created_by = $2', 'ds.is_archived = false'];
    const params: any[] = [centerId, userId];
    let paramIndex = 3;

    if (status) {
      conditions.push(`ds.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const result = await query(
      `SELECT ds.*, COUNT(dscd.id) AS drill_count
       FROM drill_sets ds
       LEFT JOIN drill_set_categories dsc ON dsc.set_id = ds.id
       LEFT JOIN drill_set_category_drills dscd ON dscd.set_category_id = dsc.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY ds.id
       ORDER BY ds.updated_at DESC`,
      params
    );

    res.status(200).json({ sets: result.rows.map(mapSetRow) });
  } catch (error) {
    console.error('List drill sets error:', error);
    res.status(500).json({ error: 'An error occurred while fetching sets' });
  }
};

/**
 * GET /api/drill-sets/:id
 * Get an own set with its nested categories and drills.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const getSetDetail = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const setResult = await query(
      `SELECT * FROM drill_sets WHERE id = $1 AND created_by = $2 AND is_archived = false`,
      [id, userId]
    );

    if (setResult.rowCount === 0) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }

    const categories = await loadSetCategories(id);

    res.status(200).json({ ...mapSetRow(setResult.rows[0]), categories });
  } catch (error) {
    console.error('Get drill set error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the set' });
  }
};

/**
 * PATCH /api/drill-sets/:id
 * Update name/description/sport. Only while draft or rejected, owner only.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const updateSet = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const allowedFields: Record<string, string> = {
      name: 'name',
      description: 'description',
      sport: 'sport',
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

    updates.push(`updated_at = NOW()`);
    params.push(id, userId);

    const result = await query(
      `UPDATE drill_sets
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND created_by = $${paramIndex + 1}
         AND is_archived = false AND status IN ('draft', 'rejected')
       RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      const existsResult = await query(
        `SELECT status FROM drill_sets WHERE id = $1 AND created_by = $2 AND is_archived = false`,
        [id, userId]
      );
      if (existsResult.rowCount === 0) {
        res.status(404).json({ error: 'Set not found' });
      } else {
        res.status(409).json({ error: 'Set cannot be edited in its current status' });
      }
      return;
    }

    res.status(200).json(mapSetRow(result.rows[0]));
  } catch (error) {
    console.error('Update drill set error:', error);
    res.status(500).json({ error: 'An error occurred while updating the set' });
  }
};

/**
 * DELETE /api/drill-sets/:id
 * Archive (soft-delete) a set. Only while draft or rejected, owner only.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const deleteSet = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await query(
      `UPDATE drill_sets SET is_archived = true, updated_at = NOW()
       WHERE id = $1 AND created_by = $2 AND is_archived = false AND status IN ('draft', 'rejected')
       RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      const existsResult = await query(
        `SELECT status FROM drill_sets WHERE id = $1 AND created_by = $2 AND is_archived = false`,
        [id, userId]
      );
      if (existsResult.rowCount === 0) {
        res.status(404).json({ error: 'Set not found' });
      } else {
        res.status(409).json({ error: 'Set cannot be deleted in its current status' });
      }
      return;
    }

    res.status(200).json({ message: 'Set deleted successfully' });
  } catch (error) {
    console.error('Delete drill set error:', error);
    res.status(500).json({ error: 'An error occurred while deleting the set' });
  }
};

/**
 * Verifies the requesting user owns the set and it is currently draft.
 * Returns the set row, or null after writing an error response.
 */
async function requireOwnDraftSet(req: TenantRequest, res: Response, setId: string | string[]) {
  const userId = req.user!.id;
  const setResult = await query(
    `SELECT id, status FROM drill_sets WHERE id = $1 AND created_by = $2 AND is_archived = false`,
    [setId, userId]
  );

  if (setResult.rowCount === 0) {
    res.status(404).json({ error: 'Set not found' });
    return null;
  }

  if (setResult.rows[0].status !== 'draft') {
    res.status(409).json({ error: 'Set cannot be edited in its current status' });
    return null;
  }

  return setResult.rows[0];
}

/**
 * POST /api/drill-sets/:id/categories
 * Add a named category to a draft set.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const createSetCategory = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const set = await requireOwnDraftSet(req, res, id);
    if (!set) return;

    const sortResult = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM drill_set_categories WHERE set_id = $1`,
      [id]
    );

    const result = await query(
      `INSERT INTO drill_set_categories (set_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [id, name, sortResult.rows[0].next_order]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      setId: row.set_id,
      name: row.name,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      drills: [],
    });
  } catch (error) {
    console.error('Create set category error:', error);
    res.status(500).json({ error: 'An error occurred while adding the category' });
  }
};

/**
 * PATCH /api/drill-sets/:id/categories/:categoryId
 * Rename a category within a draft set.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const updateSetCategory = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id, categoryId } = req.params;
    const { name } = req.body;

    const set = await requireOwnDraftSet(req, res, id);
    if (!set) return;

    const result = await query(
      `UPDATE drill_set_categories SET name = $1, updated_at = NOW()
       WHERE id = $2 AND set_id = $3
       RETURNING *`,
      [name, categoryId, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Category not found in this set' });
      return;
    }

    const row = result.rows[0];
    res.status(200).json({
      id: row.id,
      setId: row.set_id,
      name: row.name,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Update set category error:', error);
    res.status(500).json({ error: 'An error occurred while updating the category' });
  }
};

/**
 * DELETE /api/drill-sets/:id/categories/:categoryId
 * Remove a category (and its drill links) from a draft set.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const deleteSetCategory = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id, categoryId } = req.params;

    const set = await requireOwnDraftSet(req, res, id);
    if (!set) return;

    const result = await query(
      `DELETE FROM drill_set_categories WHERE id = $1 AND set_id = $2 RETURNING id`,
      [categoryId, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Category not found in this set' });
      return;
    }

    res.status(200).json({ message: 'Category removed' });
  } catch (error) {
    console.error('Delete set category error:', error);
    res.status(500).json({ error: 'An error occurred while removing the category' });
  }
};

/**
 * POST /api/drill-sets/:id/categories/:categoryId/drills
 * Add an existing (own-center, non-archived) drill to a category in a draft set.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const addDrillToSetCategory = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id, categoryId } = req.params;
    const { drillId } = req.body;
    const centerId = req.tenantCenterId;

    const set = await requireOwnDraftSet(req, res, id);
    if (!set) return;

    const categoryResult = await query(
      `SELECT id FROM drill_set_categories WHERE id = $1 AND set_id = $2`,
      [categoryId, id]
    );

    if (categoryResult.rowCount === 0) {
      res.status(404).json({ error: 'Category not found in this set' });
      return;
    }

    const drillResult = await query(
      `SELECT id FROM drills WHERE id = $1 AND center_id = $2 AND is_archived = false`,
      [drillId, centerId]
    );

    if (drillResult.rowCount === 0) {
      res.status(400).json({ error: 'Drill not found or not eligible' });
      return;
    }

    const existingItem = await query(
      `SELECT id FROM drill_set_category_drills WHERE set_category_id = $1 AND drill_id = $2`,
      [categoryId, drillId]
    );

    if (existingItem.rowCount! > 0) {
      res.status(409).json({ error: 'Drill already in this category' });
      return;
    }

    await query(
      `INSERT INTO drill_set_category_drills (set_category_id, drill_id) VALUES ($1, $2)`,
      [categoryId, drillId]
    );

    res.status(201).json({ message: 'Drill added to category' });
  } catch (error) {
    console.error('Add drill to set category error:', error);
    res.status(500).json({ error: 'An error occurred while adding the drill' });
  }
};

/**
 * DELETE /api/drill-sets/:id/categories/:categoryId/drills/:drillId
 * Remove a drill from a category in a draft set.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const removeDrillFromSetCategory = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id, categoryId, drillId } = req.params;

    const set = await requireOwnDraftSet(req, res, id);
    if (!set) return;

    const result = await query(
      `DELETE FROM drill_set_category_drills
       WHERE set_category_id = $1 AND drill_id = $2
         AND set_category_id IN (SELECT id FROM drill_set_categories WHERE set_id = $3)
       RETURNING id`,
      [categoryId, drillId, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Drill not found in this category' });
      return;
    }

    res.status(200).json({ message: 'Drill removed from category' });
  } catch (error) {
    console.error('Remove drill from set category error:', error);
    res.status(500).json({ error: 'An error occurred while removing the drill' });
  }
};

/**
 * POST /api/drill-sets/:id/submit
 * Submit a draft set for admin review. Requires at least one drill across its categories.
 * Requires: HEAD_COACH or ASSISTANT_COACH (owner only)
 */
export const submitSet = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const set = await requireOwnDraftSet(req, res, id);
    if (!set) return;

    const itemCountResult = await query(
      `SELECT COUNT(*) AS count FROM drill_set_category_drills dscd
       JOIN drill_set_categories dsc ON dsc.id = dscd.set_category_id
       WHERE dsc.set_id = $1`,
      [id]
    );

    if (Number(itemCountResult.rows[0].count) === 0) {
      res.status(400).json({ error: 'Set must contain at least one drill before submission' });
      return;
    }

    const result = await query(
      `UPDATE drill_sets
       SET status = 'pending_review', submitted_at = NOW(), updated_at = NOW(),
           reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.status(200).json(mapSetRow(result.rows[0]));
  } catch (error) {
    console.error('Submit drill set error:', error);
    res.status(500).json({ error: 'An error occurred while submitting the set' });
  }
};

/**
 * GET /api/drill-sets/marketplace
 * Browse published sets from other centers.
 * Excludes own center, adopted copies, and already-adopted sets.
 * Requires: HEAD_COACH or ASSISTANT_COACH
 */
export const listMarketplaceSets = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;

    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    const { sport, search } = req.query;
    const conditions: string[] = [
      "ds.status = 'published'",
      'ds.source_set_id IS NULL',
      'ds.is_archived = false',
      'ds.center_id != $1',
      `ds.id NOT IN (SELECT source_set_id FROM drill_sets WHERE center_id = $1 AND source_set_id IS NOT NULL)`,
    ];
    const params: any[] = [centerId];
    let paramIndex = 2;

    if (sport) {
      conditions.push(`ds.sport = $${paramIndex}`);
      params.push(sport);
      paramIndex++;
    }

    if (search) {
      conditions.push(`ds.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await query(
      `SELECT ds.*, c.name AS center_name, u.name AS coach_name, COUNT(dscd.id) AS drill_count
       FROM drill_sets ds
       JOIN centers c ON c.id = ds.center_id
       JOIN users u ON u.id = ds.created_by
       LEFT JOIN drill_set_categories dsc ON dsc.set_id = ds.id
       LEFT JOIN drill_set_category_drills dscd ON dscd.set_category_id = dsc.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY ds.id, c.name, u.name
       ORDER BY ds.updated_at DESC`,
      params
    );

    res.status(200).json({ sets: result.rows.map(mapSetRow) });
  } catch (error) {
    console.error('List marketplace sets error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the marketplace' });
  }
};

/**
 * GET /api/drill-sets/marketplace/:id
 * Preview a published set's full category/drill breakdown before adopting.
 * Requires: HEAD_COACH or ASSISTANT_COACH
 */
export const getMarketplaceSetDetail = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const centerId = req.tenantCenterId;

    const setResult = await query(
      `SELECT ds.*, c.name AS center_name, u.name AS coach_name
       FROM drill_sets ds
       JOIN centers c ON c.id = ds.center_id
       JOIN users u ON u.id = ds.created_by
       WHERE ds.id = $1 AND ds.status = 'published' AND ds.source_set_id IS NULL
         AND ds.is_archived = false AND ds.center_id != $2`,
      [id, centerId]
    );

    if (setResult.rowCount === 0) {
      res.status(404).json({ error: 'Set not found or not available' });
      return;
    }

    const categories = await loadSetCategories(id);

    res.status(200).json({ ...mapSetRow(setResult.rows[0]), categories });
  } catch (error) {
    console.error('Get marketplace set detail error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the set' });
  }
};

/**
 * POST /api/drill-sets/adopt
 * Adopt a published set: creates an independent copy of the set, its categories,
 * and every drill they contain (reusing existing adopted drill copies where
 * lineage already exists). Runs atomically inside a transaction.
 * Requires: HEAD_COACH
 */
export const adoptSet = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { setId } = req.body;
    const centerId = req.tenantCenterId;
    const userId = req.user!.id;

    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    const sourceResult = await query(
      `SELECT * FROM drill_sets
       WHERE id = $1 AND status = 'published' AND source_set_id IS NULL AND is_archived = false`,
      [setId]
    );

    if (sourceResult.rowCount === 0 || sourceResult.rows[0].center_id === centerId) {
      res.status(404).json({ error: 'Set not found or not available' });
      return;
    }

    const source = sourceResult.rows[0];

    const existingAdoption = await query(
      `SELECT id FROM drill_sets WHERE center_id = $1 AND source_set_id = $2`,
      [centerId, setId]
    );

    if (existingAdoption.rowCount! > 0) {
      res.status(409).json({ error: 'Your center has already adopted this set' });
      return;
    }

    const sourceCategories = await loadSetCategories(setId);

    const pool = Pool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const newSetResult = await client.query(
        `INSERT INTO drill_sets (name, description, sport, center_id, created_by, status, source_set_id)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6)
         RETURNING *`,
        [source.name, source.description, source.sport, centerId, userId, setId]
      );
      const newSet = newSetResult.rows[0];

      let totalDrills = 0;

      for (const category of sourceCategories) {
        const newCategoryResult = await client.query(
          `INSERT INTO drill_set_categories (set_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
          [newSet.id, category.name, category.sortOrder]
        );
        const newCategoryId = newCategoryResult.rows[0].id;

        for (const drill of category.drills || []) {
          const existingCopy = await client.query(
            `SELECT id FROM drills WHERE center_id = $1 AND source_drill_id = $2`,
            [centerId, drill.id]
          );

          let drillIdToLink: string;
          if (existingCopy.rowCount! > 0) {
            drillIdToLink = existingCopy.rows[0].id;
          } else {
            const fullDrillResult = await client.query(`SELECT * FROM drills WHERE id = $1`, [drill.id]);
            const fullDrill = fullDrillResult.rows[0];
            const newDrillResult = await client.query(
              `INSERT INTO drills (name, description, category, sport, center_id, source_drill_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [fullDrill.name, fullDrill.description, fullDrill.category, fullDrill.sport, centerId, drill.id]
            );
            drillIdToLink = newDrillResult.rows[0].id;
          }

          await client.query(
            `INSERT INTO drill_set_category_drills (set_category_id, drill_id)
             VALUES ($1, $2)
             ON CONFLICT (set_category_id, drill_id) DO NOTHING`,
            [newCategoryId, drillIdToLink]
          );
          totalDrills++;
        }
      }

      await client.query('COMMIT');

      res.status(201).json({ ...mapSetRow(newSet), drillCount: totalDrills });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Adopt drill set error:', error);
    res.status(500).json({ error: 'An error occurred while adopting the set' });
  }
};
