import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { listRoyalties, getCoachRoyaltyTotals, markCoachRoyaltiesPaid } from '../../services/royaltyService';

/**
 * GET /api/admin/coach-royalties
 * Every royalty entry (one per paid subscription to a coach-authored pack),
 * optionally filtered by coach or status. Used for the detail table under
 * the totals in the admin Payouts view.
 */
export const getRoyalties = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coachUserId = req.query.coachUserId as string | undefined;
    const status = req.query.status as 'PENDING' | 'PAID' | undefined;
    const entries = await listRoyalties({ coachUserId, status });
    res.status(200).json({ entries });
  } catch (error) {
    console.error('Get royalties error:', error);
    res.status(500).json({ error: 'An error occurred while fetching royalties' });
  }
};

/**
 * GET /api/admin/coach-royalties/totals
 * Per-coach summary (pending / paid / lifetime) — what the Payouts page's
 * main list is built from.
 */
export const getRoyaltyTotals = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totals = await getCoachRoyaltyTotals();
    res.status(200).json({ totals });
  } catch (error) {
    console.error('Get royalty totals error:', error);
    res.status(500).json({ error: 'An error occurred while fetching royalty totals' });
  }
};

/**
 * POST /api/admin/coach-royalties/:coachUserId/pay
 * Marks every currently-pending royalty for one coach as paid, in one
 * batch — the payout itself happens offline (bank transfer, UPI, etc.);
 * this just records that it happened, same pattern as subscription
 * activation for an offline payment.
 */
export const payCoachRoyalties = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const coachUserId = req.params.coachUserId as string;
    const { note } = req.body;
    const paidCount = await markCoachRoyaltiesPaid(coachUserId, req.user!.id, note);
    if (paidCount === 0) {
      res.status(409).json({ error: 'This coach has no pending royalties to pay out' });
      return;
    }
    res.status(200).json({ paidCount });
  } catch (error) {
    console.error('Pay coach royalties error:', error);
    res.status(500).json({ error: 'An error occurred while recording the payout' });
  }
};
