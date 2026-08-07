import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getMembershipsByUserId } from '../services/membershipService';

const router = Router();

// All membership routes require authentication
router.use(authenticate);

/**
 * GET /api/memberships/me
 * Returns the current user's memberships array
 */
router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const memberships = await getMembershipsByUserId(req.user!.id);
    res.json(memberships);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve memberships' });
  }
});

export default router;
