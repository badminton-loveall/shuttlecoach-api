import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantScope';
import { listRoyalties } from '../services/royaltyService';

/**
 * GET /api/royalties/mine
 * The requesting coach's own royalty history — every paid subscription to
 * a pack they authored, 60% of each sale. Head Coach only, same as who can
 * author a pack in the first place.
 */
export const getMyRoyalties = async (req: TenantRequest, res: Response): Promise<void> => {
  try {
    const entries = await listRoyalties({ coachUserId: req.user!.id });
    const pendingAmount = entries.filter((e) => e.status === 'PENDING').reduce((sum, e) => sum + e.coachAmount, 0);
    const paidAmount = entries.filter((e) => e.status === 'PAID').reduce((sum, e) => sum + e.coachAmount, 0);
    res.status(200).json({ entries, pendingAmount, paidAmount });
  } catch (error) {
    console.error('Get my royalties error:', error);
    res.status(500).json({ error: 'An error occurred while fetching your royalties' });
  }
};
