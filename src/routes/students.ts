import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
} from '../controllers/students';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createStudentSchema,
  updateStudentSchema,
  listStudentsQuerySchema,
} from '../validators/student.schemas';

const router = Router();

// All student routes require authentication
router.use(authenticate);

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
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 * Note: ASSISTANT_COACH can only access assigned students
 */
router.get(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
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

export default router;
