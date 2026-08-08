import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { UserRole } from '../types';
import {
  listBatchCoaches,
  assignCoach,
  removeCoach,
} from '../controllers/batchCoachAssignments';

const router = Router({ mergeParams: true });

// All batch coach assignment routes require authentication, active center, and tenant scoping
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * GET /api/batches/:batchId/coaches
 * List all coach assignments for a batch
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  listBatchCoaches
);

/**
 * POST /api/batches/:batchId/coaches
 * Assign a coach to a batch
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH),
  assignCoach
);

/**
 * DELETE /api/batches/:batchId/coaches/:coachId
 * Remove a coach from a batch
 * Allowed roles: HEAD_COACH
 */
router.delete(
  '/:coachId',
  authorize(UserRole.HEAD_COACH),
  removeCoach
);

export default router;
