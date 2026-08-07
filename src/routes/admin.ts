import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
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

export default router;
