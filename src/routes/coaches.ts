import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { createCoach, listCoaches, assignCoach, toggleFeeAccess, updateCoach } from '../controllers/coaches';
import { adminResetPassword } from '../controllers/password';
import { UserRole } from '../types';
import { validateRequest } from '../middleware/validation';
import { createCoachSchema, assignCoachSchema } from '../validators/coach.schemas';
import { adminResetPasswordSchema } from '../validators/password.schemas';

const router = Router();

// All coach management routes require authentication and HEAD_COACH role
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);
router.use(authorize(UserRole.HEAD_COACH));

/**
 * POST /api/coaches
 * Create a new assistant coach account
 */
router.post('/', validateRequest(createCoachSchema), createCoach);

/**
 * GET /api/coaches
 * List all assistant coaches with assignment counts
 */
router.get('/', listCoaches);

/**
 * PATCH /api/coaches/:id/fee-access
 * Toggle fee access for a coach
 */
router.patch('/:id/fee-access', toggleFeeAccess);

/**
 * PATCH /api/coaches/:id
 * Update coach profile information
 */
router.patch('/:id', updateCoach);

/**
 * PATCH /api/coaches/:id/assign
 * Assign or unassign students or batch to a coach
 */
router.patch('/:id/assign', validateRequest(assignCoachSchema), assignCoach);

/**
 * POST /api/coaches/:id/reset-password
 * Reset a coach's password (HEAD_COACH or ADMIN only)
 */
router.post('/:id/reset-password', validateRequest(adminResetPasswordSchema), adminResetPassword);

export default router;
