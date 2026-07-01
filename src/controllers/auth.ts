import { Request, Response } from 'express';
import { query } from '../config/database';
import { comparePassword, generateToken } from '../utils/auth';
import { LoginRequest, LoginResponse, User, UserRole } from '../types';
import { AuthRequest } from '../middleware/auth';

/**
 * POST /api/auth/login
 * Authenticate user with username and password, return JWT token
 */
export const login = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response
): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      res.status(400).json({
        error: 'Username and password are required',
      });
      return;
    }

    console.log('[LOGIN] Attempting login for user:', username);

    // Find user by username
    const result = await query(
      'SELECT id, username, password_hash, role, name, email, profile_photo, specialization FROM users WHERE username = $1',
      [username]
    );

    console.log('[LOGIN] Query result rows:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('[LOGIN] User not found:', username);
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

    // Generate JWT token (24h expiration)
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role as UserRole,
    });

    // Prepare response (exclude password_hash)
    const userResponse: Omit<User, 'passwordHash'> = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      email: user.email,
      profilePhoto: user.profile_photo,
      specialization: user.specialization,
      createdAt: user.created_at,
      lastActive: new Date(),
    };

    const response: LoginResponse = {
      token,
      user: userResponse,
      role: user.role,
    };

    console.log('[LOGIN] Login successful for user:', username);
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
