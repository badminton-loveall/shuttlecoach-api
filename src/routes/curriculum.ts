import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createCurriculumPlan,
  cloneBatchPlanToStudents,
  getCurriculumPlans,
  updateCurriculumPlan,
} from '../controllers/curriculum';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createCurriculumSchema,
  updateCurriculumSchema,
  cloneBatchPlanSchema,
  listCurriculumQuerySchema,
} from '../validators/curriculum.schemas';

const router = Router();

// All curriculum routes require authentication
router.use(authenticate);

/**
 * POST /api/curriculum
 * Create a new curriculum plan (batch or individual)
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createCurriculumSchema),
  createCurriculumPlan
);

/**
 * POST /api/curriculum/:id/clone
 * Clone a batch curriculum plan to all students in that batch
 * Allowed roles: HEAD_COACH only
 */
router.post(
  '/:id/clone',
  authorize(UserRole.HEAD_COACH),
  validateRequest(cloneBatchPlanSchema),
  cloneBatchPlanToStudents
);

/**
 * GET /api/curriculum
 * Query curriculum plans by filters
 * Query params: ?studentId=<id>&cycleKey=<key>&batchId=<id>
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Note: ASSISTANT_COACH automatically sees only plans for assigned students
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(listCurriculumQuerySchema),
  getCurriculumPlans
);

/**
 * PATCH /api/curriculum/:id
 * Update an individual curriculum plan
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Note: ASSISTANT_COACH can only update plans for assigned students
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(updateCurriculumSchema),
  updateCurriculumPlan
);

export default router;
