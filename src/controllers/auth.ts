import { Request, Response } from 'express';
import { query } from '../config/database';
import { comparePassword, generateToken } from '../utils/auth';
import { getMembershipsByUserId } from '../services/membershipService';
import { LoginRequest, LoginResponseMultiCenter, User, UserRole, CenterMembership } from '../types';
import { AuthRequest } from '../middleware/auth';

/**
 * POST /api/auth/login
 * Authenticate user with username and password, return JWT token.
 * Supports multi-center memberships: returns all memberships and resolves
 * the active center (from centerSlug or earliest membership).
 * ADMIN users bypass membership logic entirely.
 */
export const login = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response
): Promise<void> => {
  try {
    const { email, username, password, centerSlug } = req.body;

    // Accept email or username (email preferred)
    const identifier = email || username;

    // Validate input
    if (!identifier || !password) {
      res.status(400).json({
        error: 'Email and password are required',
      });
      return;
    }

    console.log('[LOGIN] Attempting login for user:', identifier);

    // Find user by email or username
    const result = await query(
      'SELECT id, username, password_hash, role, name, email, profile_photo, specialization, center_id, can_access_fees FROM users WHERE email = $1 OR username = $1',
      [identifier]
    );

    console.log('[LOGIN] Query result rows:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('[LOGIN] User not found:', identifier);
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    const user = result.rows[0];
    console.log('[LOGIN] User found:', user.username, 'role:', user.role);

    // Compare password with hash
    const isPasswordValid = await comparePassword(password, user.password_hash);
    console.log('[LOGIN] Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('[LOGIN] Password mismatch for user:', username);
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    // Update last_active timestamp
    await query('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1', [
      user.id,
    ]);

    // --- ADMIN bypass: no membership logic ---
    if (user.role === UserRole.ADMIN) {
      const token = generateToken({
        id: user.id,
        username: user.username,
        role: UserRole.ADMIN,
      });

      const userResponse: Omit<User, 'passwordHash'> = {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        profilePhoto: user.profile_photo,
        specialization: user.specialization,
        canAccessFees: true,
        createdAt: user.created_at,
        lastActive: new Date(),
      };

      const response: LoginResponseMultiCenter = {
        token,
        user: userResponse,
        memberships: [],
        activeCenterId: '',
        activeRole: UserRole.ADMIN,
      };

      console.log('[LOGIN] Login successful for ADMIN user:', username);
      res.status(200).json(response);
      return;
    }

    // --- Non-ADMIN: Multi-center membership flow ---

    // Query all memberships for this user (ordered by created_at ASC)
    const memberships: CenterMembership[] = await getMembershipsByUserId(user.id);

    if (memberships.length === 0) {
      res.status(403).json({ error: 'User not associated with a center' });
      return;
    }

    let activeCenterId: string;
    let activeRole: UserRole;

    if (centerSlug) {
      // Branded login: find membership matching the provided slug
      const centerBySlugResult = await query(
        'SELECT id FROM centers WHERE slug = $1',
        [centerSlug]
      );

      if (centerBySlugResult.rows.length === 0) {
        res.status(404).json({ error: 'Center not found' });
        return;
      }

      const slugCenterId = centerBySlugResult.rows[0].id;
      const matchingMembership = memberships.find(m => m.centerId === slugCenterId);

      if (!matchingMembership) {
        res.status(403).json({ error: 'You do not belong to this center' });
        return;
      }

      activeCenterId = matchingMembership.centerId;
      activeRole = matchingMembership.role;
    } else {
      // No slug: default to earliest membership (first in list, already ordered by created_at ASC)
      activeCenterId = memberships[0].centerId;
      activeRole = memberships[0].role;
    }

    // Verify active center is active and not expired
    const centerCheckResult = await query(
      'SELECT id, is_active, subscription_expires_at FROM centers WHERE id = $1',
      [activeCenterId]
    );

    if (centerCheckResult.rows.length === 0) {
      res.status(403).json({ error: 'Center not found' });
      return;
    }

    const activeCenter = centerCheckResult.rows[0];
    const isExpired =
      activeCenter.subscription_expires_at &&
      new Date(activeCenter.subscription_expires_at) < new Date();

    if (!activeCenter.is_active || isExpired) {
      res.status(403).json({ error: 'Center is currently inactive' });
      return;
    }

    // Issue JWT with active center context
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: activeRole,
      centerId: activeCenterId,
    });

    // Derive canAccessFees from the active membership
    const activeMembership = memberships.find(m => m.centerId === activeCenterId);
    const canAccessFees =
      activeRole === UserRole.HEAD_COACH
        ? true
        : activeRole === UserRole.ASSISTANT_COACH
          ? !!(activeMembership?.canAccessFees)
          : false;

    // Prepare user response (exclude password_hash)
    const userResponse: Omit<User, 'passwordHash'> = {
      id: user.id,
      username: user.username,
      role: activeRole,
      name: user.name,
      email: user.email,
      profilePhoto: user.profile_photo,
      specialization: user.specialization,
      canAccessFees,
      createdAt: user.created_at,
      lastActive: new Date(),
    };

    const response: LoginResponseMultiCenter = {
      token,
      user: userResponse,
      memberships: memberships.map(m => ({
        centerId: m.centerId,
        centerName: m.centerName,
        role: m.role,
        canAccessFees: m.canAccessFees,
      })),
      activeCenterId,
      activeRole,
    };

    console.log('[LOGIN] Login successful for user:', username, 'active center:', activeCenterId);
    res.status(200).json(response);
  } catch (error) {
    console.error('[LOGIN] Login error:', error);
    res.status(500).json({
      error: 'An error occurred during login',
    });
  }
};

/**
 * GET /api/auth/me
 * Get authenticated user profile and role
 * Requires JWT authentication
 */
export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    // Fetch full user profile from database
    const result = await query(
      'SELECT id, username, role, name, email, profile_photo, specialization, created_at, last_active FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    const user = result.rows[0];

    const userResponse: Omit<User, 'passwordHash'> = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      email: user.email,
      profilePhoto: user.profile_photo,
      specialization: user.specialization,
      createdAt: user.created_at,
      lastActive: user.last_active,
    };

    res.status(200).json({
      user: userResponse,
      role: user.role,
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching user profile',
    });
  }
};
