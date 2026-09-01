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
 * Defaults to pending_review.
 */
export const listSetsForReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string) || 'pending_review';

    const result = await query(
      `SELECT ds.*, c.name AS center_name, u.name AS coach_name, COUNT(dscd.id) AS drill_count
       FROM drill_sets ds
       JOIN centers c ON c.id = ds.center_id
       JOIN users u ON u.id = ds.created_by
       LEFT JOIN drill_set_categories dsc ON dsc.set_id = ds.id
       LEFT JOIN drill_set_category_drills dscd ON dscd.set_category_id = dsc.id
       WHERE ds.status = $1 AND ds.is_archived = false
       GROUP BY ds.id, c.name, u.name
       ORDER BY ds.submitted_at ASC NULLS LAST, ds.updated_at DESC`,
      [status]
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
