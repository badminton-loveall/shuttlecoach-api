import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getMembershipsByUserId } from '../services/membershipService';
import { query } from '../config/database';

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

/**
 * GET /api/memberships/my-center
 * Returns the current user's active center info (full details).
 * Uses the centerId from the auth middleware (X-Center-Id header or JWT).
 */
router.get('/my-center', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const centerId = req.user!.centerId;

    if (!centerId) {
      res.status(400).json({ error: 'No center associated with your account' });
      return;
    }

    const result = await query(
      `SELECT id, name, slug, location, contact_phone, contact_email, logo_url,
              is_active, plan_type, subscription_expires_at, created_at, updated_at
       FROM centers WHERE id = $1`,
      [centerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Center not found' });
      return;
    }

    const c = result.rows[0];
    res.json({
      id: c.id,
      name: c.name,
      slug: c.slug || '',
      location: c.location || '',
      contactPhone: c.contact_phone || '',
      contactEmail: c.contact_email || '',
      logoUrl: c.logo_url || '',
      isActive: c.is_active,
      planType: c.plan_type || 'basic',
      subscriptionExpiresAt: c.subscription_expires_at,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve center data' });
  }
});

export default router;
