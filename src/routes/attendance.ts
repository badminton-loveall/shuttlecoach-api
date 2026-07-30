import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  markAttendanceHandler,
  getAttendanceHandler,
  getAttendanceStatsHandler,
} from '../controllers/attendance';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  markAttendanceRequestSchema,
  getAttendanceQuerySchema,
  getAttendanceStatsQuerySchema,
} from '../types/validation';

const router = Router();

// All attendance routes require authentication
router.use(authenticate);

/**
 * POST /api/attendance
 * Create/update attendance records for a batch session (upsert semantics).
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(markAttendanceRequestSchema),
  markAttendanceHandler
);

/**
 * GET /api/attendance/stats
 * Get computed attendance statistics for a batch.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (scoped to own data)
 * Note: This route must be defined before GET /:id to avoid route conflicts.
 */
router.get(
  '/stats',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(getAttendanceStatsQuerySchema),
  getAttendanceStatsHandler
);

/**
 * GET /api/attendance
 * Query attendance records with filters.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (scoped to own data)
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(getAttendanceQuerySchema),
  getAttendanceHandler
);

export default router;
