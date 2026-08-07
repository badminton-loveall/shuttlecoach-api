import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { validateRequest, validateQuery } from '../middleware/validation';
import { UserRole } from '../types';
import {
  createLeaveRequestSchema,
  getLeaveRequestsQuerySchema,
  reviewLeaveRequestSchema,
} from '../types/validation';
import {
  createLeaveRequestHandler,
  getLeaveRequestsHandler,
  reviewLeaveRequestHandler,
} from '../controllers/leaveRequests';

const router = Router();

// All leave request routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/leave-requests
 * Create a new leave request.
 * Allowed roles: ALL (HEAD_COACH, ASSISTANT_COACH, STUDENT)
 * - Students can only create requests for themselves.
 * - Coaches can create requests for any student.
 * Validates: leaveType (PLANNED_LEAVE | SICK_LEAVE), requestedDate (future only)
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateRequest(createLeaveRequestSchema),
  createLeaveRequestHandler
);

/**
 * GET /api/leave-requests
 * List leave requests with optional filters.
 * Allowed roles: ALL (HEAD_COACH, ASSISTANT_COACH, STUDENT)
 * - Students are scoped to their own requests only.
 * Query params: batchId, studentId, status
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(getLeaveRequestsQuerySchema),
  getLeaveRequestsHandler
);

/**
 * PATCH /api/leave-requests/:id
 * Approve or reject a leave request.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Validates status transitions: only PENDING -> APPROVED or PENDING -> REJECTED
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(reviewLeaveRequestSchema),
  reviewLeaveRequestHandler
);

export default router;
