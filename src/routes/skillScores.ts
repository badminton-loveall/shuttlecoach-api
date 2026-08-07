import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import {
  recordSkillScores,
  getSkillScores,
  getSkillTimeline,
} from '../controllers/skillScores';
import { UserRole } from '../types';
import { validateRequest, validateQuery } from '../middleware/validation';
import {
  recordSkillScoresSchema,
  getSkillScoresQuerySchema,
  getSkillTimelineQuerySchema,
} from '../validators/skillScore.schemas';

const router = Router();

// All skill-scores routes require authentication
router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * POST /api/skill-scores
 * Record weekly skill scores for a student (batch upsert)
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.post(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateRequest(recordSkillScoresSchema),
  recordSkillScores
);

/**
 * GET /api/skill-scores
 * Retrieve skill scores for a student, optionally filtered by cycle
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(getSkillScoresQuerySchema),
  getSkillScores
);

/**
 * GET /api/skill-scores/timeline
 * Get timeline for a single skill across all cycles
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
router.get(
  '/timeline',
  authorize(UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH),
  validateQuery(getSkillTimelineQuerySchema),
  getSkillTimeline
);

export default router;
