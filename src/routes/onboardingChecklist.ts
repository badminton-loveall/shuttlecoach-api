import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getChecklistStatus, dismissChecklist } from '../controllers/onboardingChecklist';
import { UserRole } from '../types';

const router = Router();

// All onboarding checklist routes require authentication and HEAD_COACH role
router.use(authenticate);
router.use(authorize(UserRole.HEAD_COACH));

/**
 * GET /api/onboarding-checklist
 * Get the current onboarding checklist status with live completion detection
 */
router.get('/', getChecklistStatus);

/**
 * POST /api/onboarding-checklist/dismiss
 * Dismiss the onboarding checklist
 */
router.post('/dismiss', dismissChecklist);

export default router;
