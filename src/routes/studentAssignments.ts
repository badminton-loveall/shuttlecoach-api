import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { UserRole } from '../types';
import {
  assignStudentToCoach,
  moveStudent,
  listStudentAssignments,
} from '../controllers/studentAssignments';

const router = Router({ mergeParams: true });

// All student assignment routes require authentication, active center, and tenant scoping
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/batches/:batchId/students/assign
 * Assign a student to a coach within a batch
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/assign',
  authorize(UserRole.HEAD_COACH),
  assignStudentToCoach
);

/**
 * POST /api/batches/:batchId/students/move
 * Move a student from one coach to another within a batch
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/move',
  authorize(UserRole.HEAD_COACH),
  moveStudent
);

/**
 * GET /api/batches/:batchId/students/assignments
 * List student-coach assignments for a batch
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/assignments',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  listStudentAssignments
);

export default router;
