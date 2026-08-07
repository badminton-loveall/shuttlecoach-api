import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { UserRole } from '../types';
import { validateMembership, getMembership } from '../services/membershipService';

// Extend Express Request type to include user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: UserRole;
    centerId?: string;
    jwtCenterId?: string; // Original center from JWT
  };
}

/**
 * Middleware to authenticate JWT token and resolve active center from X-Center-Id header.
 *
 * Logic:
 * 1. Decode JWT as before
 * 2. Read X-Center-Id header; fall back to JWT centerId if absent
 * 3. If header present and differs from JWT centerId:
 *    - Validate membership via membershipService
 *    - On valid: overwrite role with membership role, set centerId to header value
 *    - On invalid: respond 403
 * 4. If header absent: use JWT centerId
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    if (!decoded) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const jwtCenterId = decoded.centerId;
    const headerCenterId = req.headers['x-center-id'] as string | undefined;

    // Default user from JWT
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      centerId: jwtCenterId,
      jwtCenterId: jwtCenterId,
    };

    // If X-Center-Id header is present and differs from JWT centerId, validate membership
    if (headerCenterId && headerCenterId !== jwtCenterId) {
      const hasMembership = await validateMembership(decoded.id, headerCenterId);

      if (!hasMembership) {
        res.status(403).json({ error: 'You do not have a membership at this center' });
        return;
      }

      // Get the specific membership to retrieve the role at this center
      const membership = await getMembership(decoded.id, headerCenterId);

      if (!membership) {
        res.status(403).json({ error: 'You do not have a membership at this center' });
        return;
      }

      // Overwrite role and centerId with the membership values
      req.user.role = membership.role;
      req.user.centerId = headerCenterId;
    } else if (headerCenterId && headerCenterId === jwtCenterId) {
      // Header present but same as JWT — use JWT values (no extra DB call needed)
      req.user.centerId = jwtCenterId;
    }
    // If no header: centerId stays as jwtCenterId (already set above)

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to check if user has required role(s)
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res
        .status(403)
        .json({ error: 'You do not have permission to perform this action' });
      return;
    }

    next();
  };
};
