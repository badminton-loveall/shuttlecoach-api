import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '../types';

/**
 * Extends AuthRequest with tenant center scoping.
 * - For non-ADMIN users: tenantCenterId is always set from JWT
 * - For ADMIN users: tenantCenterId is optionally set via center_id query param
 * - undefined means unscoped (ADMIN without center_id param)
 */
export interface TenantRequest extends AuthRequest {
  tenantCenterId?: string;
}

/**
 * Middleware that extracts and attaches the tenant center ID to the request.
 *
 * Non-ADMIN users: centerId comes from JWT. Rejects with 403 if missing.
 * ADMIN users: optionally scoped via `center_id` query parameter.
 */
export const tenantScope = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role === UserRole.ADMIN) {
    // ADMIN may optionally scope to a specific center via query param
    const queryCenterId = req.query.center_id as string | undefined;
    req.tenantCenterId = queryCenterId || undefined;
  } else {
    // Non-ADMIN: centerId comes from JWT
    const centerId = req.user.centerId;
    if (!centerId) {
      res.status(403).json({ error: 'User not associated with a center' });
      return;
    }
    req.tenantCenterId = centerId;
  }

  next();
};
