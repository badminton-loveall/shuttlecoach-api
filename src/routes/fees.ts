import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createFee,
  listFees,
  markFeePaid,
  waiveFee,
} from '../controllers/fees';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createFeeSchema,
  markFeePaidSchema,
  waiveFeeSchema,
  listFeesQuerySchema,
} from '../validators/fee.schemas';

const router = Router();

// All fee routes require authentication
router.use(authenticate);

/**
 * POST /api/fees
 * Create a new fee record
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH),
  validateRequest(createFeeSchema),
  createFee
);

/**
 * GET /api/fees
 * Query fee records with filters
 * Query params: ?studentId=<id>&status=<PAID|PENDING|OVERDUE|WAIVED>&monthYear=<2026-01>
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT
 * Note: 
 * - ASSISTANT_COACH sees fees for assigned students only
 * - STUDENT sees only their own fees
 * - Overdue status is computed dynamically: due_date < CURRENT_DATE AND status = 'PENDING'
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(listFeesQuerySchema),
  listFees
);

/**
 * PATCH /api/fees/:id/pay
 * Mark a fee as paid with payment details
 * Allowed roles: HEAD_COACH
 */
router.patch(
  '/:id/pay',
  authorize(UserRole.HEAD_COACH),
  validateRequest(markFeePaidSchema),
  markFeePaid
);

/**
 * PATCH /api/fees/:id/waive
 * Mark a fee as waived with a reason
 * Allowed roles: HEAD_COACH
 */
router.patch(
  '/:id/waive',
  authorize(UserRole.HEAD_COACH),
  validateRequest(waiveFeeSchema),
  waiveFee
);

export default router;
