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
  addOfficialSetCategory,
  deleteOfficialSetCategory,
  addOfficialSetDrill,
  removeOfficialSetDrill,
} from '../controllers/admin/drillSets';
import {
  adminSetQuerySchema,
  rejectSetSchema,
  createSetCategorySchema,
  addDrillToSetCategorySchema,
} from '../validators/drillSet.schemas';

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
 * POST /api/admin/drill-sets/:id/categories
 * Add a category to the official catalog (Badminton Drills Pack).
 */
router.post(
  '/drill-sets/:id/categories',
  validateRequest(createSetCategorySchema),
  addOfficialSetCategory
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

export default router;
