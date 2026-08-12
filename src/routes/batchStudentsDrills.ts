import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { validateQuery } from '../middleware/validation';
import { batchStudentsDrillsQuerySchema } from '../types/validation';
import { getBatchStudentsDrills } from '../controllers/batchStudentsDrills';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * GET /api/batch-students-drills
 * Returns students in a batch with their drill assignments for a specific date.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(batchStudentsDrillsQuerySchema),
  getBatchStudentsDrills
);

export default router;
