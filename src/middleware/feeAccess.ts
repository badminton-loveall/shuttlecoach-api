import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenantScope';
import { UserRole } from '../types';
import { query } from '../config/database';

/**
 * Middleware that checks if the current user has fee access.
 * - ADMIN and HEAD_COACH: always allowed
 * - STUDENT: always allowed (controller scopes to own records)
 * - ASSISTANT_COACH: allowed only if can_access_fees = true
 */
export const requireFeeAccess = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { role, id } = req.user;

  // ADMIN and HEAD_COACH always have fee access
  if (role === UserRole.ADMIN || role === UserRole.HEAD_COACH) {
    next();
    return;
  }

  // STUDENT always allowed (controller handles scoping)
  if (role === UserRole.STUDENT) {
    next();
    return;
  }

  // ASSISTANT_COACH: check can_access_fees flag
  try {
    const result = await query(
      'SELECT can_access_fees FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].can_access_fees) {
      res.status(403).json({
        error: 'You do not have permission to access fee data. Contact your head coach to request access.',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[FeeAccess] Database query failed:', error);
    res.status(500).json({ error: 'An internal error occurred. Please try again later.' });
  }
};
