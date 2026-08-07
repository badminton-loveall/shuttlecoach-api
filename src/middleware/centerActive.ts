import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantScope';
import { UserRole } from '../types';
import { query } from '../config/database';

/**
 * Middleware that verifies the user's center is active and has a valid subscription.
 *
 * - Skips the check entirely for ADMIN users.
 * - For non-ADMIN users: queries the centers table to confirm is_active = true
 *   and subscription_expires_at is in the future.
 * - Rejects with 403 if the center is inactive, expired, or not found.
 */
export const centerActive = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip check for ADMIN users
  if (req.user?.role === UserRole.ADMIN) {
    next();
    return;
  }

  const centerId = req.user?.centerId;

  if (!centerId) {
    res.status(403).json({ error: 'Center is currently inactive' });
    return;
  }

  try {
    const result = await query(
      'SELECT is_active, subscription_expires_at FROM centers WHERE id = $1',
      [centerId]
    );

    if (result.rows.length === 0) {
      res.status(403).json({ error: 'Center is currently inactive' });
      return;
    }

    const center = result.rows[0];

    if (!center.is_active) {
      res.status(403).json({ error: 'Center is currently inactive' });
      return;
    }

    if (
      center.subscription_expires_at &&
      new Date(center.subscription_expires_at) < new Date()
    ) {
      res.status(403).json({ error: 'Center is currently inactive' });
      return;
    }

    next();
  } catch (error) {
    console.error('[CenterActive] Error checking center status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
