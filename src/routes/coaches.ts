import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { createCoach, listCoaches, assignCoach, toggleFeeAccess, updateCoach, getCoach } from '../controllers/coaches';
import { adminResetPassword } from '../controllers/password';
import { UserRole } from '../types';
import { validateRequest } from '../middleware/validation';
import { createCoachSchema, assignCoachSchema } from '../validators/coach.schemas';
import { adminResetPasswordSchema } from '../validators/password.schemas';

const router = Router();

// All coach management routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/coaches
 * Create a new assistant coach account
 */
router.post('/', authorize(UserRole.HEAD_COACH), validateRequest(createCoachSchema), createCoach);

/**
 * GET /api/coaches
 * List all assistant coaches with assignment counts
 */
router.get('/', authorize(UserRole.HEAD_COACH), listCoaches);

/**
 * GET /api/coaches/:id
 * Get single coach profile (HEAD_COACH or own profile for ASSISTANT_COACH)
 */
router.get('/:id', getCoach);

/**
 * PATCH /api/coaches/:id/fee-access
 * Toggle fee access for a coach
 */
router.patch('/:id/fee-access', authorize(UserRole.HEAD_COACH), toggleFeeAccess);

/**
 * PATCH /api/coaches/:id
 * Update coach profile information
 */
router.patch('/:id', authorize(UserRole.HEAD_COACH), updateCoach);

/**
 * PATCH /api/coaches/:id/assign
 * Assign or unassign students or batch to a coach
 */
router.patch('/:id/assign', authorize(UserRole.HEAD_COACH), validateRequest(assignCoachSchema), assignCoach);

/**
 * POST /api/coaches/:id/reset-password
 * Reset a coach's password (HEAD_COACH or ADMIN only)
 */
router.post('/:id/reset-password', authorize(UserRole.HEAD_COACH), validateRequest(adminResetPasswordSchema), adminResetPassword);

export default router;
