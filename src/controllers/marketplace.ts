import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';
import { UserRole } from '../types';
import {
  listCatalog,
  getActiveSubscriptions,
  getCenterRequests,
  requestSubscription,
  getEffectiveCapacity,
} from '../services/subscriptionService';

/**
 * GET /api/marketplace/items
 * Browse the catalog — only items currently on sale (Catalog Switch on).
 * Coach-facing only; students never see prices.
 */
export const browseCatalog = async (_req: TenantRequest, res: Response): Promise<void> => {
  try {
    const items = await listCatalog(false);
    res.status(200).json(items);
  } catch (error) {
    console.error('Browse marketplace catalog error:', error);
    res.status(500).json({ error: 'An error occurred while loading the marketplace' });
  }
};

/**
 * GET /api/marketplace/my-subscriptions
 * The requesting center's active subscriptions — feeds the Accounting
 * Section's "subscription payments" panel alongside salaries and fees.
 */
export const listMySubscriptions = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;
    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }
    const subscriptions = await getActiveSubscriptions(centerId);
    res.status(200).json(subscriptions);
  } catch (error) {
    console.error('List my subscriptions error:', error);
    res.status(500).json({ error: 'An error occurred while loading subscriptions' });
  }
};

/**
 * GET /api/marketplace/my-requests
 * The requesting center's pending subscription requests, awaiting admin approval.
 */
export const listMyRequests = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;
    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }
    const requests = await getCenterRequests(centerId);
    res.status(200).json(requests);
  } catch (error) {
    console.error('List my subscription requests error:', error);
    res.status(500).json({ error: 'An error occurred while loading requests' });
  }
};

/**
 * POST /api/marketplace/subscribe
 * Coach self-serve: a free item activates immediately; a paid item creates a
 * request that shows up in the admin approval queue.
 */
export const subscribeToItem = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;
    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }
    const { marketplaceItemId } = req.body;
    if (!marketplaceItemId) {
      res.status(400).json({ error: 'marketplaceItemId is required' });
      return;
    }

    const { subscription, autoActivated } = await requestSubscription(centerId, marketplaceItemId, req.user!.id);
    res.status(201).json({ subscription, autoActivated });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'MARKETPLACE_ITEM_NOT_FOUND') {
      res.status(404).json({ error: 'Marketplace item not found' });
      return;
    }
    if (message === 'ITEM_NOT_ENABLED') {
      res.status(409).json({ error: 'This item is not currently available for sale' });
      return;
    }
    if (message === 'ALREADY_SUBSCRIBED') {
      res.status(409).json({ error: 'Your center is already subscribed to this item' });
      return;
    }
    if (message === 'ALREADY_REQUESTED') {
      res.status(409).json({ error: 'A request for this item is already awaiting approval' });
      return;
    }
    console.error('Subscribe to item error:', error);
    res.status(500).json({ error: 'An error occurred while requesting this item' });
  }
};

/**
 * GET /api/marketplace/capacity
 * How many coaches/students this center currently has versus its Coach/
 * Student Capacity limit — feeds the "X of Y used" indicator (and upgrade
 * prompt) on the Coaches and Students pages, where a coach actually notices
 * a limit rather than only in the Subscriptions tab.
 */
export const getCapacityStatus = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;
    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    const [coachLimit, studentLimit, coachCountResult, studentCountResult] = await Promise.all([
      getEffectiveCapacity(centerId, 'COACH_CAPACITY'),
      getEffectiveCapacity(centerId, 'STUDENT_CAPACITY'),
      query(
        `SELECT COUNT(*) FROM user_center_memberships WHERE center_id = $1 AND role IN ($2, $3)`,
        [centerId, UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH]
      ),
      query('SELECT COUNT(*) FROM students WHERE center_id = $1', [centerId]),
    ]);

    res.status(200).json({
      coachLimit,
      coachCount: parseInt(coachCountResult.rows[0].count, 10),
      studentLimit,
      studentCount: parseInt(studentCountResult.rows[0].count, 10),
    });
  } catch (error) {
    console.error('Get capacity status error:', error);
    res.status(500).json({ error: 'An error occurred while loading capacity status' });
  }
};

/**
 * GET /api/marketplace/drill-sets/:id/video-urls
 * Whole-set gating, never a single drill: resolves the set to its canonical
 * (source) id, finds that set's Video-Enhanced marketplace listing, and
 * — only if the center holds an active subscription to it — returns every
 * drill's demonstration clip in one call. A STUDENT caller additionally needs
 * the center's own student_video_access_enabled toggle to be on; the purchase
 * itself always stays B2B (a center buys the tier, never a student).
 */
export const getDrillSetVideoUrls = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const centerId = req.tenantCenterId;
    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    const setResult = await query('SELECT id, source_set_id FROM drill_sets WHERE id = $1', [id]);
    if (setResult.rowCount === 0) {
      res.status(404).json({ error: 'Set not found' });
      return;
    }
    const canonicalSetId = setResult.rows[0].source_set_id || setResult.rows[0].id;

    const itemResult = await query(
      `SELECT mi.id AS item_id, cs.id AS subscription_id, cs.student_video_access_enabled
       FROM marketplace_items mi
       LEFT JOIN center_subscriptions cs
         ON cs.marketplace_item_id = mi.id AND cs.center_id = $2 AND cs.status = 'ACTIVE'
            AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       WHERE mi.drill_set_id = $1 AND mi.tier = 'VIDEO_ENHANCED'
       LIMIT 1`,
      [canonicalSetId, centerId]
    );

    const item = itemResult.rows[0];

    // No Video-Enhanced listing for this set, or the center has no active
    // subscription to it — nothing to return.
    if (!item || !item.subscription_id) {
      res.status(200).json({});
      return;
    }

    // Purchase is B2B; a STUDENT caller additionally needs the center's own opt-in.
    if (req.user?.role === UserRole.STUDENT && !item.student_video_access_enabled) {
      res.status(200).json({});
      return;
    }

    const drillsResult = await query(
      `SELECT d.id, COALESCE(d.video_url, src.video_url) AS video_url
       FROM drill_set_category_drills dscd
       JOIN drill_set_categories dsc ON dsc.id = dscd.set_category_id
       JOIN drills d ON d.id = dscd.drill_id
       LEFT JOIN drills src ON src.id = d.source_drill_id
       WHERE dsc.set_id = $1 AND COALESCE(d.video_url, src.video_url) IS NOT NULL`,
      [id]
    );

    const videoUrls: Record<string, string> = {};
    for (const row of drillsResult.rows) {
      videoUrls[row.id] = row.video_url;
    }

    res.status(200).json(videoUrls);
  } catch (error) {
    console.error('Get drill set video urls error:', error);
    res.status(500).json({ error: 'An error occurred while loading video access' });
  }
};
