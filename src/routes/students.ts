import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
} from '../controllers/students';
import { adminResetStudentPassword, sendStudentResetEmail } from '../controllers/password';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createStudentSchema,
  updateStudentSchema,
  listStudentsQuerySchema,
} from '../validators/student.schemas';
import { adminResetPasswordSchema } from '../validators/password.schemas';

const router = Router();

// All student routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/students
 * Create a new student
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createStudentSchema),
  createStudent
);

/**
 * GET /api/students
 * List students with filtering and pagination
 * Query params: ?batch=<id>&coach=<id>&search=<name>&page=1&limit=20
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Note: ASSISTANT_COACH automatically sees only assigned students
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(listStudentsQuerySchema),
  listStudents
);

/**
 * GET /api/students/:id
 * Fetch a single student by ID
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT
 * Note: ASSISTANT_COACH can only access assigned students; STUDENT can only access themselves
 */
router.get(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  getStudent
);

/**
 * PATCH /api/students/:id
 * Update a student with partial data
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Note: ASSISTANT_COACH can only update assigned students
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(updateStudentSchema),
  updateStudent
);

/**
 * POST /api/students/:id/reset-password
 * Admin/HEAD_COACH resets a student's login password directly (no email
 * round-trip needed). Uses a student-specific controller rather than the
 * coaches one — a student may not have a `users` row at all yet (only
 * created on enrollment if an email was on file, via a step that could
 * previously fail silently), so this looks the student up by their
 * `students` row and creates the missing login account on the fly if needed,
 * instead of returning "User not found" and leaving the admin stuck.
 * Allowed roles: ADMIN, HEAD_COACH
 */
router.post(
  '/:id/reset-password',
  authorize(UserRole.ADMIN, UserRole.HEAD_COACH),
  validateRequest(adminResetPasswordSchema),
  adminResetStudentPassword
);

/**
 * POST /api/students/:id/send-reset-email
 * Admin/HEAD_COACH triggers a password-reset email to the student instead of
 * setting a password manually — creates their login account first if one
 * doesn't exist yet (same self-healing as the reset-password route above).
 * Allowed roles: ADMIN, HEAD_COACH
 */
router.post(
  '/:id/send-reset-email',
  authorize(UserRole.ADMIN, UserRole.HEAD_COACH),
  sendStudentResetEmail
);

export default router;
