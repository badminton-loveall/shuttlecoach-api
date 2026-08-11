import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { validateRequest } from '../middleware/validation';
import { UserRole } from '../types';
import { generateSalarySchema } from '../validators/salary.schemas';
import {
  generateSalary,
  listSalary,
  getCoachSalary,
  markSalaryPaid,
  revertSalaryPaid,
} from '../controllers/salary';

const router = Router();

// All salary routes require authentication, active center, and tenant scope
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/salary/generate
 * Generate PENDING salary records for all eligible coaches in the center.
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/generate',
  authorize(UserRole.HEAD_COACH),
  validateRequest(generateSalarySchema),
  generateSalary
);

/**
 * GET /api/salary
 * List salary records for a given period (defaults to current month).
 * Allowed roles: HEAD_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH),
  listSalary
);

/**
 * GET /api/salary/coach/:coachId
 * Get salary history for a specific coach.
 * Allowed roles: HEAD_COACH
 */
router.get(
  '/coach/:coachId',
  authorize(UserRole.HEAD_COACH),
  getCoachSalary
);

/**
 * PATCH /api/salary/:id/pay
 * Mark a salary record as paid with payment details.
 * Allowed roles: HEAD_COACH
 */
router.patch(
  '/:id/pay',
  authorize(UserRole.HEAD_COACH),
  markSalaryPaid
);

/**
 * PATCH /api/salary/:id/revert
 * Revert a paid salary back to PENDING status.
 * Allowed roles: HEAD_COACH
 */
router.patch(
  '/:id/revert',
  authorize(UserRole.HEAD_COACH),
  revertSalaryPaid
);

export default router;
