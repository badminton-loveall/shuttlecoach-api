import { Response, NextFunction } from 'express';
import { query } from '../config/database';
import { TenantRequest } from './tenantScope';
import { UserRole } from '../types';

/**
 * Middleware that blocks access to Marketplace-tab features (global drill
 * marketplace, drill sets, adoption) when the requesting center's ADMIN-controlled
 * `marketplace_enabled` flag is off. ADMIN requests (unscoped or explicitly
 * scoped) are never blocked.
 */
export const requireMarketplaceEnabled = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.role === UserRole.ADMIN) {
      next();
      return;
    }

    const centerId = req.tenantCenterId;

    if (!centerId) {
      res.status(400).json({ error: 'Center context is required' });
      return;
    }

    const result = await query('SELECT marketplace_enabled FROM centers WHERE id = $1', [centerId]);

    if (result.rowCount === 0) {
      res.status(500).json({ error: 'Failed to resolve center configuration' });
      return;
    }

    if (!result.rows[0].marketplace_enabled) {
      res.status(403).json({ error: 'The marketplace is not enabled for your center' });
      return;
    }

    next();
  } catch (error) {
    console.error('Marketplace enabled check error:', error);
    res.status(500).json({ error: 'An error occurred while checking marketplace access' });
  }
};
