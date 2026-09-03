import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { getRevenueByItem, getAllCenterSubscriptions } from '../../services/subscriptionService';

/**
 * GET /api/admin/subscription-analytics
 * Two views for admin: which catalog items earn the most (byItem), and
 * which centers hold what, with what they paid (byCenter).
 */
export const getSubscriptionAnalytics = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [byItem, byCenter] = await Promise.all([getRevenueByItem(), getAllCenterSubscriptions()]);
    res.status(200).json({ byItem, byCenter });
  } catch (error) {
    console.error('Get subscription analytics error:', error);
    res.status(500).json({ error: 'An error occurred while loading subscription analytics' });
  }
};
