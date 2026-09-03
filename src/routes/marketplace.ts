import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { requireMarketplaceEnabled } from '../middleware/marketplaceEnabled';
import { UserRole } from '../types';
import {
  browseCatalog,
  listMySubscriptions,
  listMyRequests,
  subscribeToItem,
  getDrillSetVideoUrls,
  getCapacityStatus,
} from '../controllers/marketplace';

const router = Router();

// Same gating as the drill-sets marketplace — the whole Marketplace tab
// (catalog, subscriptions, video access) lives behind one enabled check.
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);
router.use(requireMarketplaceEnabled);

const COACH_ROLES = [UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH];

/**
 * GET /api/marketplace/items
 * Browse the catalog. Coach-facing only — students never see a price.
 */
router.get('/items', authorize(...COACH_ROLES), browseCatalog);

/**
 * GET /api/marketplace/my-subscriptions
 * The center's active subscriptions.
 */
router.get('/my-subscriptions', authorize(...COACH_ROLES), listMySubscriptions);

/**
 * GET /api/marketplace/my-requests
 * The center's pending subscription requests.
 */
router.get('/my-requests', authorize(UserRole.HEAD_COACH), listMyRequests);

/**
 * POST /api/marketplace/subscribe
 * Request (or, for a free item, immediately activate) a marketplace item.
 * HEAD_COACH only — subscribing is a head-coach decision.
 */
router.post('/subscribe', authorize(UserRole.HEAD_COACH), subscribeToItem);

/**
 * GET /api/marketplace/capacity
 * Current coach/student headcount vs. limit for this center.
 */
router.get('/capacity', authorize(...COACH_ROLES), getCapacityStatus);

/**
 * GET /api/marketplace/drill-sets/:id/video-urls
 * Resolved demonstration-clip URLs for a subscribed Video-Enhanced set.
 * Open to STUDENT too — video access, unlike everything else here, can be
 * extended to them at the center's discretion (student_video_access_enabled).
 */
router.get(
  '/drill-sets/:id/video-urls',
  authorize(...COACH_ROLES, UserRole.STUDENT),
  getDrillSetVideoUrls
);

export default router;
