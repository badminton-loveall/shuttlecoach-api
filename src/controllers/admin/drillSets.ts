import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

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
    isEnabled: row.is_enabled,
    isOfficial: row.is_official,
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
 * GET /api/admin/drill-sets
 * Review queue: list drill sets across all centers, filterable by status.
 * Defaults to pending_review; status=all returns every status (the
 * full-catalog Marketplace browse view, as opposed to the approval queue).
 */
export const listSetsForReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string) || 'pending_review';
    const conditions = ['ds.is_archived = false'];
    const params: any[] = [];

    if (status !== 'all') {
      conditions.push('ds.status = $1');
      params.push(status);
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
       ORDER BY ds.is_official DESC, ds.submitted_at ASC NULLS LAST, ds.updated_at DESC`,
      params
    );

    res.status(200).json({ sets: result.rows.map(mapSetRow) });
  } catch (error) {
    console.error('List sets for review error:', error);
    res.status(500).json({ error: 'An error occurred while fetching sets' });
  }
};

/**
 * GET /api/admin/drill-sets/:id
 * Full nested detail (categories + drills) for admin review.
 */
export const getSetForReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const setResult = await query(
      `SELECT ds.*, c.name AS center_name, u.name AS coach_name
       FROM drill_sets ds
       JOIN centers c ON c.id = ds.center_id
       JOIN users u ON u.id = ds.created_by
       WHERE ds.id = $1 AND ds.is_archived = false`,
      [id]
    );

    if (setResult.rowCount === 0) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }

    const categories = await loadSetCategories(id);

    res.status(200).json({ ...mapSetRow(setResult.rows[0]), categories });
  } catch (error) {
    console.error('Get set for review error:', error);
    res.status(500).json({ error: 'An error occurred while fetching the set' });
  }
};

/**
 * POST /api/admin/drill-sets/:id/approve
 * pending_review -> published
 */
export const approveSet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    const result = await query(
      `UPDATE drill_sets
       SET status = 'published', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'pending_review' AND is_archived = false
       RETURNING *`,
      [adminId, id]
    );

    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Set is not pending review' });
      return;
    }

    res.status(200).json(mapSetRow(result.rows[0]));
  } catch (error) {
    console.error('Approve set error:', error);
    res.status(500).json({ error: 'An error occurred while approving the set' });
  }
};

/**
 * POST /api/admin/drill-sets/:id/reject
 * pending_review -> rejected (+ optional reason)
 */
export const rejectSet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user!.id;

    const result = await query(
      `UPDATE drill_sets
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(),
           rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status = 'pending_review' AND is_archived = false
       RETURNING *`,
      [adminId, reason || null, id]
    );

    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Set is not pending review' });
      return;
    }

    res.status(200).json(mapSetRow(result.rows[0]));
  } catch (error) {
    console.error('Reject set error:', error);
    res.status(500).json({ error: 'An error occurred while rejecting the set' });
  }
};

/**
 * POST /api/admin/drill-sets/:id/reset-to-draft
 * published|rejected -> draft, so a coach can rework and resubmit it (the
 * only path back to editable for a rejected set, since coach-side mutators
 * require status='draft'). Never applies to the official catalog
 * (is_official=true), which has no approve/reject workflow and is always
 * 'published' by design. Cascades: any enabled marketplace_items rows tied
 * to this set are disabled too, since content back in draft has nothing
 * approved to sell.
 */
export const resetSetToDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE drill_sets
       SET status = 'draft', reviewed_by = NULL, reviewed_at = NULL,
           rejection_reason = NULL, updated_at = NOW()
       WHERE id = $1 AND status IN ('published', 'rejected')
         AND is_archived = false AND is_official = false
       RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(409).json({ error: 'Set cannot be reset to draft in its current state' });
      return;
    }

    await query(
      `UPDATE marketplace_items SET is_enabled = false, updated_at = NOW()
       WHERE drill_set_id = $1 AND is_enabled = true`,
      [id]
    );

    res.status(200).json(mapSetRow(result.rows[0]));
  } catch (error) {
    console.error('Reset set to draft error:', error);
    res.status(500).json({ error: 'An error occurred while resetting the set to draft' });
  }
};

/**
 * Verifies the target set is the admin-curated official catalog (is_official).
 * Admin editing is intentionally restricted to official sets only — mutating
 * a coach's already-published content directly would bypass their ownership
 * and the submit/review workflow entirely.
 */
async function requireOfficialSet(res: Response, setId: string | string[]) {
  const result = await query(
    `SELECT id FROM drill_sets WHERE id = $1 AND is_official = true AND is_archived = false`,
    [setId]
  );

  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Official set not found' });
    return false;
  }

  return true;
}

/**
 * POST /api/admin/drill-sets/:id/categories
 * Add a category to the official catalog. Unlike coach-owned sets, this
 * works regardless of status (the official set is always 'published').
 */
export const addOfficialSetCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!(await requireOfficialSet(res, id))) return;

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
    console.error('Add official set category error:', error);
    res.status(500).json({ error: 'An error occurred while adding the category' });
  }
};

/**
 * DELETE /api/admin/drill-sets/:id/categories/:categoryId
 * Remove a category (and its drill links) from the official catalog.
 */
export const deleteOfficialSetCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, categoryId } = req.params;

    if (!(await requireOfficialSet(res, id))) return;

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
    console.error('Delete official set category error:', error);
    res.status(500).json({ error: 'An error occurred while removing the category' });
  }
};

/**
 * POST /api/admin/drill-sets/:id/categories/:categoryId/drills
 * Add an existing global drill (center_id IS NULL) to a category in the
 * official catalog.
 */
export const addOfficialSetDrill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, categoryId } = req.params;
    const { drillId } = req.body;

    if (!(await requireOfficialSet(res, id))) return;

    const categoryResult = await query(
      `SELECT id FROM drill_set_categories WHERE id = $1 AND set_id = $2`,
      [categoryId, id]
    );

    if (categoryResult.rowCount === 0) {
      res.status(404).json({ error: 'Category not found in this set' });
      return;
    }

    const drillResult = await query(
      `SELECT id FROM drills WHERE id = $1 AND center_id IS NULL AND is_archived = false`,
      [drillId]
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
    console.error('Add official set drill error:', error);
    res.status(500).json({ error: 'An error occurred while adding the drill' });
  }
};

/**
 * DELETE /api/admin/drill-sets/:id/categories/:categoryId/drills/:drillId
 * Remove a drill from a category in the official catalog.
 */
export const removeOfficialSetDrill = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, categoryId, drillId } = req.params;

    if (!(await requireOfficialSet(res, id))) return;

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
    console.error('Remove official set drill error:', error);
    res.status(500).json({ error: 'An error occurred while removing the drill' });
  }
};
