import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantScope';
import { UserRole } from '../types';
import { query } from '../config/database';

/**
 * Gates the coach-facing Finance menu (fee management, the ledger) behind an
 * active Accounting Section subscription. ADMIN (platform oversight) and
 * STUDENT (their own fee record, a personal view unrelated to the center's
 * Finance menu) are unaffected — only HEAD_COACH/ASSISTANT_COACH are checked.
 * The underlying data is never touched by this — losing access just hides
 * it until the center subscribes again.
 */
export const requireAccountingSubscription = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.STUDENT) {
    next();
    return;
  }

  const centerId = req.tenantCenterId;
  if (!centerId) {
    res.status(400).json({ error: 'Center context is required' });
    return;
  }

  try {
    const result = await query(
      `SELECT 1 FROM center_subscriptions cs
       JOIN marketplace_items mi ON mi.id = cs.marketplace_item_id
       WHERE cs.center_id = $1 AND mi.category = 'ACCOUNTING' AND cs.status = 'ACTIVE'
         AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       LIMIT 1`,
      [centerId]
    );

    if (result.rowCount === 0) {
      res.status(403).json({ error: 'Your center does not have an active Accounting Section subscription.' });
      return;
    }

    next();
  } catch (error) {
    console.error('[AccountingSubscription] Check failed:', error);
    res.status(500).json({ error: 'An error occurred while checking Accounting access' });
  }
};
