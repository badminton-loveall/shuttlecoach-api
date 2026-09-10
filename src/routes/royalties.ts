import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { centerActive } from '../middleware/centerActive';
import { tenantScope } from '../middleware/tenantScope';
import { getMyRoyalties } from '../controllers/royalties';
import { UserRole } from '../types';

const router = Router();

router.use(authenticate);
router.use(centerActive);
router.use(tenantScope);

/**
 * GET /api/royalties/mine
 * Allowed roles: HEAD_COACH — only Head Coaches author drill packs.
 */
router.get('/mine', authorize(UserRole.HEAD_COACH), getMyRoyalties);

export default router;
