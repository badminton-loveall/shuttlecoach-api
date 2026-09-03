import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { getPendingRequests, approveRequest, rejectRequest } from '../../services/subscriptionService';

/**
 * GET /api/admin/subscription-requests
 * Every center's pending self-serve requests, oldest first.
 */
export const listSubscriptionRequests = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await getPendingRequests();
    res.status(200).json(requests);
  } catch (error) {
    console.error('List subscription requests error:', error);
    res.status(500).json({ error: 'An error occurred while listing subscription requests' });
  }
};

/**
 * POST /api/admin/subscription-requests/:id/approve
 * The center paid offline; admin confirms it here and the item goes live.
 */
export const approveSubscriptionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { priceOverride, expiresAt } = req.body;

    const subscription = await approveRequest(id, req.user!.id, { priceOverride, expiresAt });

    if (!subscription) {
      res.status(404).json({ error: 'Pending request not found' });
      return;
    }

    res.status(200).json(subscription);
  } catch (error) {
    console.error('Approve subscription request error:', error);
    res.status(500).json({ error: 'An error occurred while approving the request' });
  }
};

/**
 * POST /api/admin/subscription-requests/:id/reject
 */
export const rejectSubscriptionRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const subscription = await rejectRequest(id);

    if (!subscription) {
      res.status(404).json({ error: 'Pending request not found' });
      return;
    }

    res.status(200).json(subscription);
  } catch (error) {
    console.error('Reject subscription request error:', error);
    res.status(500).json({ error: 'An error occurred while rejecting the request' });
  }
};
