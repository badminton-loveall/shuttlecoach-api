import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { validateRequest } from '../middleware/validation';
import { UserRole } from '../types';
import {
  createTemplate,
  listTemplates,
  getTemplate,
  updateTemplate,
  archiveTemplate,
} from '../controllers/batchTimeTemplates';
import {
  createTemplateSchema,
  updateTemplateSchema,
} from '../validators/batchTimeTemplate.schemas';

const router = Router();

// All template routes require authentication, active center, and tenant scoping
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * GET /api/batch-time-templates
 * List all non-archived templates for the current center
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  listTemplates
);

/**
 * GET /api/batch-time-templates/:id
 * Get a single template with its session slots
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/:id',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  getTemplate
);

/**
 * POST /api/batch-time-templates
 * Create a new template with session slots
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH),
  validateRequest(createTemplateSchema),
  createTemplate
);

/**
 * PATCH /api/batch-time-templates/:id
 * Update a template (name and/or slots)
 * Allowed roles: HEAD_COACH
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH),
  validateRequest(updateTemplateSchema),
  updateTemplate
);

/**
 * DELETE /api/batch-time-templates/:id
 * Archive a template (soft-delete, blocked if in use by active batches)
 * Allowed roles: HEAD_COACH
 */
router.delete(
  '/:id',
  authorize(UserRole.HEAD_COACH),
  archiveTemplate
);

export default router;
