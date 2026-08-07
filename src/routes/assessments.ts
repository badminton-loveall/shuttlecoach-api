import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import {
  createAssessment,
  listAssessments,
  getAssessment,
  updateAssessment,
} from '../controllers/assessments';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createAssessmentSchema,
  listAssessmentsQuerySchema,
} from '../validators/assessment.schemas';

const router = Router();

// All assessment routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/assessments
 * Create a new skill assessment snapshot with coach metadata
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Rejects: Past cycle assessments (403 Forbidden)
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createAssessmentSchema),
  createAssessment
);

/**
 * GET /api/assessments
 * Query assessments with optional filtering
 * Query params: ?studentId=<id>&cycleKey=<key>
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(listAssessmentsQuerySchema),
  listAssessments
);

/**
 * GET /api/assessments/:id
 * Fetch a single assessment by ID
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT
 */
router.get(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  getAssessment
);

/**
 * PATCH /api/assessments/:id
 * Update an assessment
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Rejects: Past cycle assessments (403 Forbidden)
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createAssessmentSchema),
  updateAssessment
);

export default router;
