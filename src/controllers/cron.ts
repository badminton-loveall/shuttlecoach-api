import { Request, Response } from 'express';
import { generateMonthlyFees } from '../services/billingService';

/**
 * GET /api/cron/generate-monthly-fees
 * Daily automated billing run, hit by Vercel Cron (see vercel.json). Unscoped — processes every
 * center in one pass, since a cron request has no user session/tenant to scope by. Idempotent
 * (generateMonthlyFees skips students who already have a fee for the current month), so hitting
 * this more than once a day, or every day within the same month, never creates duplicates.
 *
 * Secured via CRON_SECRET: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 * once the env var is set. If CRON_SECRET isn't configured yet, the check is skipped (with a
 * warning logged) so the endpoint still works before the user sets it up in the Vercel dashboard.
 */
export const generateMonthlyFeesCron = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${cronSecret}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    } else {
      console.warn('[cron] CRON_SECRET is not set — /api/cron/generate-monthly-fees is unprotected');
    }

    const result = await generateMonthlyFees();
    res.status(200).json(result);
  } catch (error) {
    console.error('Generate monthly fees (cron) error:', error);
    res.status(500).json({
      error: 'An error occurred while generating monthly fee records',
    });
  }
};
