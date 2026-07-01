import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createTrainingLog,
  getTrainingLogs,
  updateTrainingLog,
} from '../controllers/trainingLogs';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createTrainingLogSchema,
  listTrainingLogsQuerySchema,
} from '../validators/trainingLog.schemas';

const router = Router();

// All training log routes require authentication
router.use(authenticate);

/**
 * POST /api/training-logs
 * Create a new training log entry
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createTrainingLogSchema),
  createTrainingLog
);

/**
 * GET /api/training-logs
 * Query training logs by filters
 * Query params: ?studentId=<id>&cycleKey=<key>
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Note: ASSISTANT_COACH automatically sees only logs for assigned students
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(listTrainingLogsQuerySchema),
  getTrainingLogs
);

/**
 * PATCH /api/training-logs/:id
 * Update an existing training log
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Note: ASSISTANT_COACH can only update logs for assigned students
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createTrainingLogSchema),
  updateTrainingLog
);

export default router;
