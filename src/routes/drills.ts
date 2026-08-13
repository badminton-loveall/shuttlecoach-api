import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { createDrill, listDrills, updateDrill, archiveDrill, listMarketplaceDrills, adoptDrill, adoptAllDrills } from '../controllers/drills';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import { createDrillSchema, updateDrillSchema, listDrillsQuerySchema, marketplaceQuerySchema, adoptDrillSchema } from '../validators/drill.schemas';

const router = Router();

// All drill routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * GET /api/drills
 * List drills with optional category/search filters
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(listDrillsQuerySchema),
  listDrills
);

/**
 * POST /api/drills
 * Create a new drill
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH),
  validateRequest(createDrillSchema),
  createDrill
);

/**
 * GET /api/drills/marketplace
 * Browse global drills filtered by center sport
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/marketplace',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(marketplaceQuerySchema),
  listMarketplaceDrills
);

/**
 * POST /api/drills/adopt
 * Adopt a global drill into center library
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/adopt',
  authorize(UserRole.HEAD_COACH),
  validateRequest(adoptDrillSchema),
  adoptDrill
);

/**
 * POST /api/drills/adopt-all
 * Adopt all available marketplace drills in one go
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/adopt-all',
  authorize(UserRole.HEAD_COACH),
  adoptAllDrills
);

/**
 * PATCH /api/drills/:id
 * Update a drill with partial data
 * Allowed roles: HEAD_COACH
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH),
  validateRequest(updateDrillSchema),
  updateDrill
);

/**
 * DELETE /api/drills/:id
 * Archive a drill (soft-delete)
 * Allowed roles: HEAD_COACH
 */
router.delete(
  '/:id',
  authorize(UserRole.HEAD_COACH),
  archiveDrill
);

export default router;
