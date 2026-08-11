import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  attachCourseToBatch,
} from '../controllers/courses';
import { UserRole } from '../types';

const router = Router();

// All course routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/courses
 * Create a new reusable course template
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  createCourse
);

/**
 * GET /api/courses
 * List all courses for the authenticated coach
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  getCourses
);

/**
 * GET /api/courses/:id
 * Get a single course by ID with ownership check
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  getCourseById
);

/**
 * PUT /api/courses/:id
 * Update an existing course (name and/or weeks)
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.put(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  updateCourse
);

/**
 * DELETE /api/courses/:id
 * Delete a course (does not cascade to curriculum_plans)
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.delete(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  deleteCourse
);

/**
 * POST /api/courses/:id/attach
 * Attach a course to a batch, creating batch and student curriculum plans
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/:id/attach',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  attachCourseToBatch
);

export default router;
