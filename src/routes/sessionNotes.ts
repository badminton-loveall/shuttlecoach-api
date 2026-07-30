import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createSessionNoteHandler,
  getSessionNotesHandler,
} from '../controllers/sessionNotes';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  createSessionNoteSchema,
  getSessionNotesQuerySchema,
} from '../types/validation';

const router = Router();

// All session notes routes require authentication
router.use(authenticate);

/**
 * POST /api/session-notes
 * Create or update a coach note for a specific batch session date.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH (coach-only write access)
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(createSessionNoteSchema),
  createSessionNoteHandler
);

/**
 * GET /api/session-notes/:batchId
 * Get coach notes for a batch with optional date range filtering.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (all authenticated users)
 */
router.get(
  '/:batchId',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH, UserRole.STUDENT),
  validateQuery(getSessionNotesQuerySchema),
  getSessionNotesHandler
);

export default router;
