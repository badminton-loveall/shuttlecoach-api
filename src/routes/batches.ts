import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { createBatch, listBatches, updateBatch, archiveBatch } from '../controllers/batches';
import { UserRole } from '../types';
import { validateRequest } from '../middleware/validation';
import { createBatchSchema, updateBatchSchema } from '../validators/batch.schemas';

const router = Router();

// All batch routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * GET /api/batches
 * List all non-archived batches
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  listBatches
);

/**
 * POST /api/batches
 * Create a new batch
 * Allowed roles: HEAD_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH),
  validateRequest(createBatchSchema),
  createBatch
);

/**
 * PATCH /api/batches/:id
 * Update a batch with partial data
 * Allowed roles: HEAD_COACH
 */
router.patch(
  '/:id',
  authorize(UserRole.HEAD_COACH),
  validateRequest(updateBatchSchema),
  updateBatch
);

/**
 * DELETE /api/batches/:id
 * Archive a batch (soft-delete)
 * Allowed roles: HEAD_COACH
 */
router.delete(
  '/:id',
  authorize(UserRole.HEAD_COACH),
  archiveBatch
);

export default router;
