import { Response } from 'express';
import { query } from '../config/database';
import { comparePassword, hashPassword } from '../utils/auth';
import { validatePassword } from '../utils/passwordValidator';
import { generateResetToken, hashToken } from '../utils/tokenGenerator';
import { sendPasswordResetEmail } from '../services/emailService';
import { TenantRequest } from '../middleware/tenantScope';
import { UserRole } from '../types';

/**
 * PUT /api/auth/change-password
 * Self-service password change for authenticated users.
 */
export const changePassword = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Fetch current password hash
    const userResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid current password' });
      return;
    }

    // Hash and update
    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('[PASSWORD] Change password error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * POST /api/coaches/:id/reset-password
 * Admin or HEAD_COACH resets another user's password.
 */
export const adminResetPassword = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { role } = req.user;

    // Only ADMIN and HEAD_COACH can perform admin resets
    if (role !== UserRole.ADMIN && role !== UserRole.HEAD_COACH) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }

    const targetUserId = req.params.id;
    const { newPassword } = req.body;

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Check target user exists
    const targetResult = await query(
      'SELECT id, center_id FROM users WHERE id = $1',
      [targetUserId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // HEAD_COACH: verify target user belongs to same center
    if (role === UserRole.HEAD_COACH) {
      const targetCenterId = targetResult.rows[0].center_id;
      if (targetCenterId !== req.tenantCenterId) {
        res.status(403).json({ error: 'You can only reset passwords for users in your center' });
        return;
      }
    }

    // Hash and update
    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, targetUserId]);

    res.status(200).json({ message: 'Password reset successfully', newPassword });
  } catch (error) {
    console.error('[PASSWORD] Admin reset password error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * POST /api/auth/forgot-password
 * Generate a reset token and email it to the user.
 * Always returns the same response shape to prevent email enumeration.
 */
export const forgotPassword = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    // Always return same response regardless of email existence
    const successResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };

    // Look up user by email
    const userResult = await query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      res.status(200).json(successResponse);
      return;
    }

    const user = userResult.rows[0];

    // Invalidate existing tokens for this user
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    // Generate new token
    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store hashed token
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt.toISOString()]
    );

    // Send email with reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to: user.email,
      resetLink,
      userName: user.name,
    });

    res.status(200).json(successResponse);
  } catch (error) {
    console.error('[PASSWORD] Forgot password error:', error);
    // Still return 200 to prevent enumeration via error responses
    res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  }
};

/**
 * POST /api/auth/reset-password
 * Consume a reset token and set a new password.
 */
export const resetPassword = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    // Hash the submitted token to look it up
    const tokenHash = hashToken(token);

    // Find the token in DB
    const tokenResult = await query(
      'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    const tokenRow = tokenResult.rows[0];

    // Check if already used
    if (tokenRow.used_at) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    // Check expiry
    if (new Date(tokenRow.expires_at) < new Date()) {
      res.status(400).json({ error: 'Token expired' });
      return;
    }

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Hash and update user password
    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, tokenRow.user_id]);

    // Mark token as used
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenRow.id]);

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('[PASSWORD] Reset password error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};
