import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { UserRole } from '../types';
import { validateQuery } from '../middleware/validation';
import {
  getDrillCompletionQuerySchema,
  getEffectivenessQuerySchema,
  getBatchComparisonQuerySchema,
  getStudentComparisonQuerySchema,
  getTrainingPatternsQuerySchema,
} from '../types/validation';
import {
  getDrillCompletionHandler,
  getEffectivenessHandler,
  getBatchComparisonHandler,
  getStudentComparisonHandler,
  getStudentTrendsHandler,
  getTrainingPatternsHandler,
} from '../controllers/analytics';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * GET /api/analytics/session/:cycleKey
 * Drill completion rates for a cycle.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/session/:cycleKey',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(getDrillCompletionQuerySchema),
  getDrillCompletionHandler
);

/**
 * GET /api/analytics/effectiveness/:studentId
 * Skill improvement correlation for a student.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (own data only)
 */
router.get(
  '/effectiveness/:studentId',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(getEffectivenessQuerySchema),
  getEffectivenessHandler
);

/**
 * GET /api/analytics/comparison/batches
 * Batch-level comparison metrics.
 * Allowed roles: HEAD_COACH only
 */
router.get(
  '/comparison/batches',
  authorize(UserRole.HEAD_COACH),
  validateQuery(getBatchComparisonQuerySchema),
  getBatchComparisonHandler
);

/**
 * GET /api/analytics/comparison/students
 * Student-level comparison within a batch.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/comparison/students',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(getStudentComparisonQuerySchema),
  getStudentComparisonHandler
);

/**
 * GET /api/analytics/trends/:studentId
 * Attendance vs skill improvement trend data across cycles.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (own data only)
 */
router.get(
  '/trends/:studentId',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  getStudentTrendsHandler
);

/**
 * GET /api/analytics/patterns
 * Training pattern distributions (category breakdown, attendance heatmap).
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/patterns',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(getTrainingPatternsQuerySchema),
  getTrainingPatternsHandler
);

export default router;
