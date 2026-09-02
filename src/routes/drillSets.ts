import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { requireMarketplaceEnabled } from '../middleware/marketplaceEnabled';
import { validateRequest, validateQuery } from '../middleware/validation';
import { UserRole } from '../types';
import {
  createSet,
  listOwnSets,
  getSetDetail,
  updateSet,
  deleteSet,
  createSetCategory,
  updateSetCategory,
  deleteSetCategory,
  addDrillToSetCategory,
  removeDrillFromSetCategory,
  submitSet,
  listMarketplaceSets,
  getMarketplaceSetDetail,
  adoptSet,
  toggleSetEnabled,
} from '../controllers/drillSets';
import {
  createDrillSetSchema,
  updateDrillSetSchema,
  createSetCategorySchema,
  updateSetCategorySchema,
  addDrillToSetCategorySchema,
  adoptSetSchema,
  listOwnSetsQuerySchema,
  setMarketplaceQuerySchema,
  toggleSetEnabledSchema,
} from '../validators/drillSet.schemas';

const router = Router();

// All routes require authentication, tenant (center) scoping, and an
// enabled marketplace for the requesting center — the entire Drill Set
// workflow (authoring + browsing + adopting) lives inside the Marketplace tab.
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);
router.use(requireMarketplaceEnabled);

const COACH_ROLES = [UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH];

/**
 * GET /api/drill-sets/marketplace
 * Browse published sets from other centers.
 * NOTE: registered before /:id routes to avoid path collision.
 */
router.get(
  '/marketplace',
  authorize(...COACH_ROLES),
  validateQuery(setMarketplaceQuerySchema),
  listMarketplaceSets
);

/**
 * GET /api/drill-sets/marketplace/:id
 * Preview a published set before adopting.
 */
router.get('/marketplace/:id', authorize(...COACH_ROLES), getMarketplaceSetDetail);

/**
 * POST /api/drill-sets/adopt
 * Adopt a published set into the center's library.
 */
router.post('/adopt', authorize(UserRole.HEAD_COACH), validateRequest(adoptSetSchema), adoptSet);

/**
 * GET /api/drill-sets
 * List the requesting coach's own sets.
 */
router.get('/', authorize(...COACH_ROLES), validateQuery(listOwnSetsQuerySchema), listOwnSets);

/**
 * POST /api/drill-sets
 * Create a new draft set.
 */
router.post('/', authorize(...COACH_ROLES), validateRequest(createDrillSetSchema), createSet);

/**
 * GET /api/drill-sets/:id
 * Get an own set with its nested categories and drills.
 */
router.get('/:id', authorize(...COACH_ROLES), getSetDetail);

/**
 * PATCH /api/drill-sets/:id
 * Update a draft/rejected set.
 */
router.patch('/:id', authorize(...COACH_ROLES), validateRequest(updateDrillSetSchema), updateSet);

/**
 * DELETE /api/drill-sets/:id
 * Archive a draft/rejected set.
 */
router.delete('/:id', authorize(...COACH_ROLES), deleteSet);

/**
 * PATCH /api/drill-sets/:id/enabled
 * Enable/disable a set the center owns or has adopted, in any status.
 */
router.patch(
  '/:id/enabled',
  authorize(UserRole.HEAD_COACH),
  validateRequest(toggleSetEnabledSchema),
  toggleSetEnabled
);

/**
 * POST /api/drill-sets/:id/categories
 * Add a category to a draft set.
 */
router.post(
  '/:id/categories',
  authorize(...COACH_ROLES),
  validateRequest(createSetCategorySchema),
  createSetCategory
);

/**
 * PATCH /api/drill-sets/:id/categories/:categoryId
 * Rename a category in a draft set.
 */
router.patch(
  '/:id/categories/:categoryId',
  authorize(...COACH_ROLES),
  validateRequest(updateSetCategorySchema),
  updateSetCategory
);

/**
 * DELETE /api/drill-sets/:id/categories/:categoryId
 * Remove a category from a draft set.
 */
router.delete('/:id/categories/:categoryId', authorize(...COACH_ROLES), deleteSetCategory);

/**
 * POST /api/drill-sets/:id/categories/:categoryId/drills
 * Add a drill to a category in a draft set.
 */
router.post(
  '/:id/categories/:categoryId/drills',
  authorize(...COACH_ROLES),
  validateRequest(addDrillToSetCategorySchema),
  addDrillToSetCategory
);

/**
 * DELETE /api/drill-sets/:id/categories/:categoryId/drills/:drillId
 * Remove a drill from a category in a draft set.
 */
router.delete(
  '/:id/categories/:categoryId/drills/:drillId',
  authorize(...COACH_ROLES),
  removeDrillFromSetCategory
);

/**
 * POST /api/drill-sets/:id/submit
 * Submit a draft set for admin review.
 */
router.post('/:id/submit', authorize(...COACH_ROLES), submitSet);

export default router;
