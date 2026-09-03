import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { mapMarketplaceItemRow } from '../../services/subscriptionService';

/**
 * GET /api/admin/marketplace-items
 * The full catalog, including disabled items — admin manages everything here.
 * Optional ?category=A,B,C restricts to those categories (e.g. the Marketplace
 * admin page wants only DRILL_PACK, the Subscriptions page wants everything else).
 */
export const listMarketplaceItems = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categoryParam = req.query.category as string | undefined;
    const categories = categoryParam
      ? categoryParam.split(',').map((c) => c.trim()).filter(Boolean)
      : null;

    const result = categories && categories.length > 0
      ? await query(
          'SELECT * FROM marketplace_items WHERE category = ANY($1::text[]) ORDER BY category, price',
          [categories]
        )
      : await query('SELECT * FROM marketplace_items ORDER BY category, price');

    res.status(200).json(result.rows.map(mapMarketplaceItemRow));
  } catch (error) {
    console.error('List marketplace items error:', error);
    res.status(500).json({ error: 'An error occurred while listing marketplace items' });
  }
};

/**
 * POST /api/admin/marketplace-items
 * Create a new catalog item — a drill-pack listing (Standard or Video-Enhanced
 * tier of an existing drill_sets row), an Accounting listing, or a capacity tier.
 * price = 0 shows as "Free" in the marketplace; durationDays auto-expires the
 * subscription that many days after activation (used for time-limited demos).
 * A drill pack is always a one-time purchase, never a recurring subscription —
 * billing_period is derived from category, not accepted from the request.
 */
export const createMarketplaceItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, category, drillSetId, tier, capacityLimit, price, durationDays } = req.body;

    if (!name || !category || price === undefined) {
      res.status(400).json({ error: 'name, category, and price are required' });
      return;
    }

    // A drill pack can only be packaged for sale once its content has cleared
    // review — otherwise a coach could sell drills that were never approved.
    if (category === 'DRILL_PACK' && drillSetId) {
      const setResult = await query('SELECT status FROM drill_sets WHERE id = $1', [drillSetId]);
      if (setResult.rowCount === 0) {
        res.status(400).json({ error: 'Drill set not found' });
        return;
      }
      if (setResult.rows[0].status !== 'published') {
        res.status(400).json({ error: 'Drill set must be published before it can be packaged for sale' });
        return;
      }
    }

    const billingPeriod = category === 'DRILL_PACK' ? 'ONE_TIME' : 'MONTHLY';

    const result = await query(
      `INSERT INTO marketplace_items (name, description, category, drill_set_id, tier, capacity_limit, price, duration_days, billing_period)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name,
        description ?? null,
        category,
        drillSetId ?? null,
        tier ?? null,
        capacityLimit ?? null,
        price,
        durationDays ?? null,
        billingPeriod,
      ]
    );

    res.status(201).json(mapMarketplaceItemRow(result.rows[0]));
  } catch (error: any) {
    if (error?.code === '23505') {
      res.status(409).json({ error: 'This drill set already has a listing at that tier' });
      return;
    }
    console.error('Create marketplace item error:', error);
    res.status(500).json({ error: 'An error occurred while creating the marketplace item' });
  }
};

/**
 * PATCH /api/admin/marketplace-items/:id
 * Edit price, description, duration, or the Catalog Switch (isEnabled).
 * Disabling an item is soft — existing active subscriptions keep working
 * until they'd naturally expire; only new subscribing/browsing is blocked.
 */
export const updateMarketplaceItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, price, durationDays, isEnabled } = req.body;

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }
    if (description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }
    if (price !== undefined) {
      setClauses.push(`price = $${paramIndex}`);
      params.push(price);
      paramIndex++;
    }
    if (durationDays !== undefined) {
      setClauses.push(`duration_days = $${paramIndex}`);
      params.push(durationDays);
      paramIndex++;
    }
    if (isEnabled !== undefined) {
      setClauses.push(`is_enabled = $${paramIndex}`);
      params.push(isEnabled);
      paramIndex++;
    }

    params.push(id);

    const result = await query(
      `UPDATE marketplace_items SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Marketplace item not found' });
      return;
    }

    res.status(200).json(mapMarketplaceItemRow(result.rows[0]));
  } catch (error) {
    console.error('Update marketplace item error:', error);
    res.status(500).json({ error: 'An error occurred while updating the marketplace item' });
  }
};
