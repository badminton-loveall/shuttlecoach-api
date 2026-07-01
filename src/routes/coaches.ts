import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { createCoach, listCoaches, assignCoach } from '../controllers/coaches';
import { UserRole } from '../types';
import { validateRequest } from '../middleware/validation';
import { createCoachSchema, assignCoachSchema } from '../validators/coach.schemas';

const router = Router();

// All coach management routes require authentication and HEAD_COACH role
router.use(authenticate);
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
 * PATCH /api/coaches/:id/assign
 * Assign or unassign students or batch to a coach
 */
router.patch('/:id/assign', validateRequest(assignCoachSchema), assignCoach);

export default router;
