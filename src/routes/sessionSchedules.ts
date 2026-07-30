import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createSessionScheduleHandler,
  getSessionScheduleHandler,
  getSessionCalendarHandler,
} from '../controllers/sessionSchedules';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createSessionScheduleSchema,
  getSessionCalendarQuerySchema,
} from '../types/validation';

const router = Router();

// All session schedule routes require authentication
router.use(authenticate);

/**
 * POST /api/session-schedules
 * Create or update a session schedule for a batch.
 * Allowed roles: HEAD_COACH only (write restriction per Requirement 16.8)
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH),
  validateRequest(createSessionScheduleSchema),
  createSessionScheduleHandler
);

/**
 * GET /api/session-schedules/:batchId
 * Retrieve the structured session schedule for a batch.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (read-only per Requirement 16.9)
 */
router.get(
  '/:batchId',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  getSessionScheduleHandler
);

export default router;

// ============================================================================
// Session Calendar Router (mounted separately at /api/session-calendar)
// ============================================================================

export const sessionCalendarRouter = Router();

sessionCalendarRouter.use(authenticate);

/**
 * GET /api/session-calendar
 * Get calendar data with mapped curriculum drills for a date range.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (scoped to own batch)
 */
sessionCalendarRouter.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(getSessionCalendarQuerySchema),
  getSessionCalendarHandler
);
