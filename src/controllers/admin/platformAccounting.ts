import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { getPlatformLedgerSummary } from '../../services/ledgerService';

/**
 * GET /api/admin/platform-accounting
 * Every real center's income/expense totals in one place — optional ?month
 * (YYYY-MM) to scope the period; omitted means all-time.
 */
export const getPlatformAccounting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const month = req.query.month as string | undefined;
    const summary = await getPlatformLedgerSummary(month);
    res.status(200).json(summary);
  } catch (error) {
    console.error('Get platform accounting error:', error);
    res.status(500).json({ error: 'An error occurred while loading platform accounting' });
  }
};
