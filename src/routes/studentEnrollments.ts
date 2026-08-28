import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { validateRequest } from '../middleware/validation';
import { UserRole } from '../types';
import {
  createStudentEnrollment,
  listStudentEnrollments,
  listStudentDrillRecords,
  updateStudentDrillRecord,
} from '../controllers/studentEnrollments';
import {
  createEnrollmentSchema,
  updateDrillRecordSchema,
} from '../validators/studentEnrollment.schemas';

// Mounted at /students/:studentId/enrollments and /students/:studentId/drill-records
const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/students/:studentId/enrollments
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/enrollments',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createEnrollmentSchema),
  createStudentEnrollment
);

/**
 * GET /api/students/:studentId/enrollments
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/enrollments',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  listStudentEnrollments
);

/**
 * GET /api/students/:studentId/drill-records
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/drill-records',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  listStudentDrillRecords
);

/**
 * PATCH /api/students/:studentId/drill-records/:id
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.patch(
  '/drill-records/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(updateDrillRecordSchema),
  updateStudentDrillRecord
);

export default router;
