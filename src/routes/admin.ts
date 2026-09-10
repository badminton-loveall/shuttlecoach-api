import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validateRequest, validateQuery } from '../middleware/validation';
import { UserRole } from '../types';
import {
  listCenters,
  createCenter,
  updateCenter,
  getCenterStats,
} from '../controllers/admin/centers';
import { assignCoach, unassignCoach } from '../controllers/admin/coachAssignment';
import { toggleCenterActivation } from '../controllers/admin/centerActivation';
import { getDashboard } from '../controllers/admin/dashboard';
import { inviteCoach, resetCoachPassword } from '../controllers/admin/coachActions';
import {
  listGlobalDrills,
  createGlobalDrill,
  updateGlobalDrill,
  archiveGlobalDrill,
} from '../controllers/admin/drills';
import {
  createGlobalDrillSchema,
  updateDrillSchema,
  adminListDrillsQuerySchema,
} from '../validators/drill.schemas';
import {
  listSetsForReview,
  getSetForReview,
  approveSet,
  rejectSet,
  resetSetToDraft,
  updateOfficialSet,
  updateOfficialSetCategory,
  addOfficialSetCategory,
  deleteOfficialSetCategory,
  addOfficialSetDrill,
  removeOfficialSetDrill,
} from '../controllers/admin/drillSets';
import {
  adminSetQuerySchema,
  rejectSetSchema,
  updateDrillSetSchema,
  createSetCategorySchema,
  updateSetCategorySchema,
  addDrillToSetCategorySchema,
} from '../validators/drillSet.schemas';
import { listMarketplaceItems, createMarketplaceItem, updateMarketplaceItem } from '../controllers/admin/marketplaceItems';
import {
  listCenterSubscriptions,
  activateCenterSubscription,
  cancelCenterSubscription,
} from '../controllers/admin/subscriptions';
import {
  listSubscriptionRequests,
  approveSubscriptionRequest,
  rejectSubscriptionRequest,
} from '../controllers/admin/subscriptionRequests';
import { getSubscriptionAnalytics } from '../controllers/admin/subscriptionAnalytics';
import { getPlatformAccounting } from '../controllers/admin/platformAccounting';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(authorize(UserRole.ADMIN));

/**
 * GET /api/admin/dashboard
 * Aggregate stats across all centers
 */
router.get('/dashboard', getDashboard);

/**
 * GET /api/admin/centers
 * List all centers
 */
router.get('/centers', listCenters);

/**
 * POST /api/admin/centers
 * Create a new center
 */
router.post('/centers', createCenter);

/**
 * PATCH /api/admin/centers/:id
 * Update center attributes
 */
router.patch('/centers/:id', updateCenter);

/**
 * GET /api/admin/centers/:id/stats
 * Get per-center statistics
 */
router.get('/centers/:id/stats', getCenterStats);

/**
 * POST /api/admin/centers/:id/assign-coach
 * Assign HEAD_COACH to center
 */
router.post('/centers/:id/assign-coach', assignCoach);

/**
 * POST /api/admin/centers/:id/unassign-coach
 * Remove HEAD_COACH from center
 */
router.post('/centers/:id/unassign-coach', unassignCoach);

/**
 * POST /api/admin/centers/:id/activate
 * Activate or deactivate a center
 */
router.post('/centers/:id/activate', toggleCenterActivation);

/**
 * POST /api/admin/centers/:id/invite-coach
 * Send invite email to the center's head coach
 */
router.post('/centers/:id/invite-coach', inviteCoach);

/**
 * POST /api/admin/centers/:id/reset-coach-password
 * Generate a password reset token and send email to head coach
 */
router.post('/centers/:id/reset-coach-password', resetCoachPassword);

/**
 * GET /api/admin/drills
 * List global drills (filterable by sport, category, search)
 */
router.get('/drills', validateQuery(adminListDrillsQuerySchema), listGlobalDrills);

/**
 * POST /api/admin/drills
 * Create a new global drill
 */
router.post('/drills', validateRequest(createGlobalDrillSchema), createGlobalDrill);

/**
 * PATCH /api/admin/drills/:id
 * Update a global drill
 */
router.patch('/drills/:id', validateRequest(updateDrillSchema), updateGlobalDrill);

/**
 * DELETE /api/admin/drills/:id
 * Archive a global drill (soft-delete)
 */
router.delete('/drills/:id', archiveGlobalDrill);

/**
 * GET /api/admin/drill-sets
 * Review queue: list coach-submitted drill sets (default: pending_review)
 */
router.get('/drill-sets', validateQuery(adminSetQuerySchema), listSetsForReview);

/**
 * GET /api/admin/drill-sets/:id
 * Full nested detail (categories + drills) for review
 */
router.get('/drill-sets/:id', getSetForReview);

/**
 * POST /api/admin/drill-sets/:id/approve
 * pending_review -> published
 */
router.post('/drill-sets/:id/approve', approveSet);

/**
 * POST /api/admin/drill-sets/:id/reject
 * pending_review -> rejected (+ optional reason)
 */
router.post('/drill-sets/:id/reject', validateRequest(rejectSetSchema), rejectSet);

/**
 * POST /api/admin/drill-sets/:id/reset-to-draft
 * published|rejected -> draft (never for the official catalog). Also
 * disables any marketplace_items packages tied to this set.
 */
router.post('/drill-sets/:id/reset-to-draft', resetSetToDraft);

/**
 * PATCH /api/admin/drill-sets/:id
 * Rename the official catalog (or update description/sport).
 */
router.patch('/drill-sets/:id', validateRequest(updateDrillSetSchema), updateOfficialSet);

/**
 * POST /api/admin/drill-sets/:id/categories
 * Add a category to the official catalog (Badminton Drills Pack).
 */
router.post(
  '/drill-sets/:id/categories',
  validateRequest(createSetCategorySchema),
  addOfficialSetCategory
);

/**
 * PATCH /api/admin/drill-sets/:id/categories/:categoryId
 * Rename a category in the official catalog.
 */
router.patch(
  '/drill-sets/:id/categories/:categoryId',
  validateRequest(updateSetCategorySchema),
  updateOfficialSetCategory
);

/**
 * DELETE /api/admin/drill-sets/:id/categories/:categoryId
 * Remove a category from the official catalog.
 */
router.delete('/drill-sets/:id/categories/:categoryId', deleteOfficialSetCategory);

/**
 * POST /api/admin/drill-sets/:id/categories/:categoryId/drills
 * Add a global drill to a category in the official catalog.
 */
router.post(
  '/drill-sets/:id/categories/:categoryId/drills',
  validateRequest(addDrillToSetCategorySchema),
  addOfficialSetDrill
);

/**
 * DELETE /api/admin/drill-sets/:id/categories/:categoryId/drills/:drillId
 * Remove a drill from a category in the official catalog.
 */
router.delete('/drill-sets/:id/categories/:categoryId/drills/:drillId', removeOfficialSetDrill);

/**
 * GET /api/admin/marketplace-items
 * The full catalog, including disabled items.
 */
router.get('/marketplace-items', listMarketplaceItems);

/**
 * POST /api/admin/marketplace-items
 * Create a catalog item (drill-pack listing, Accounting, or a capacity tier).
 */
router.post('/marketplace-items', createMarketplaceItem);

/**
 * PATCH /api/admin/marketplace-items/:id
 * Edit price, description, duration, or the Catalog Switch (isEnabled).
 */
router.patch('/marketplace-items/:id', updateMarketplaceItem);

/**
 * GET /api/admin/centers/:id/subscriptions
 * A center's active marketplace subscriptions.
 */
router.get('/centers/:id/subscriptions', listCenterSubscriptions);

/**
 * POST /api/admin/centers/:id/subscriptions
 * Admin-assisted activation after offline payment.
 */
router.post('/centers/:id/subscriptions', activateCenterSubscription);

/**
 * PATCH /api/admin/centers/:id/subscriptions/:marketplaceItemId/cancel
 * Cancel a center's active subscription to one item.
 */
router.patch('/centers/:id/subscriptions/:marketplaceItemId/cancel', cancelCenterSubscription);

/**
 * GET /api/admin/subscription-requests
 * Every center's pending self-serve requests.
 */
router.get('/subscription-requests', listSubscriptionRequests);

/**
 * POST /api/admin/subscription-requests/:id/approve
 */
router.post('/subscription-requests/:id/approve', approveSubscriptionRequest);

/**
 * POST /api/admin/subscription-requests/:id/reject
 */
router.post('/subscription-requests/:id/reject', rejectSubscriptionRequest);

/**
 * GET /api/admin/subscription-analytics
 * Revenue by item, and every center's subscription/payment history.
 */
router.get('/subscription-analytics', getSubscriptionAnalytics);

/**
 * GET /api/admin/platform-accounting
 * Every real center's income/expense totals in one place.
 */
router.get('/platform-accounting', getPlatformAccounting);

export default router;
