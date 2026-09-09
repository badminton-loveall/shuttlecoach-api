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
 * POST /api/students/:id/reset-password
 * Admin or HEAD_COACH resets a student's login password directly.
 *
 * Unlike adminResetPassword (used for coaches), a student may not have a
 * `users` row at all yet — that row is only created when the student was
 * originally enrolled with an email address, via a step that (until a
 * recent fix) could silently fail to run on Vercel's serverless runtime.
 * So instead of failing with "User not found" and leaving the admin stuck
 * with no way forward, this creates the missing login account on the fly
 * (reusing the student's on-file name/email, same as normal enrollment)
 * when the student otherwise has everything needed for one.
 */
type StudentAccountResolution =
  | { ok: true; email: string; name: string; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Shared by adminResetStudentPassword and sendStudentResetEmail: resolves the
 * student's login account, self-healing by creating it on the fly (same as
 * normal enrollment — see createStudent) when one doesn't exist yet, instead
 * of failing with "User not found" and leaving the admin stuck. Whatever hash
 * is passed in becomes the account's password_hash *only* if a new account
 * has to be created here; an existing account's password is left untouched
 * (the caller decides separately what to do with it — set it directly, or
 * email a reset link).
 */
async function resolveStudentAccount(
  studentId: string,
  role: UserRole,
  tenantCenterId: string | undefined,
  passwordHashForNewAccount: string
): Promise<StudentAccountResolution> {
  // Look up the student record itself (not `users`) — this is the source
  // of truth for whether this student exists at all and which center they
  // belong to, independent of whether a login account was ever created.
  const studentResult = await query(
    'SELECT id, full_name, email, center_id FROM students WHERE id = $1',
    [studentId]
  );

  if (studentResult.rows.length === 0) {
    return { ok: false, status: 404, error: 'Student not found' };
  }

  const student = studentResult.rows[0];

  // HEAD_COACH: verify the student belongs to their own center
  if (role === UserRole.HEAD_COACH && student.center_id !== tenantCenterId) {
    return { ok: false, status: 403, error: 'You can only manage students in your center' };
  }

  // Does this student already have a login account? (users.id === students.id)
  const existingUser = await query('SELECT id FROM users WHERE id = $1', [studentId]);
  if (existingUser.rows.length > 0) {
    return { ok: true, email: student.email, name: student.full_name, created: false };
  }

  // No account yet. We need an email on file to use as the login username
  // — without one there's nothing to create an account with.
  if (!student.email) {
    return {
      ok: false,
      status: 400,
      error: 'This student has no email on file, so no login account exists yet. Add an email in their profile, then try again.',
    };
  }

  // Guard against the email already being tied to a different account
  // (e.g. a guardian or coach using the same address) — same check used
  // during normal student enrollment.
  const emailOwner = await query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
    [student.email]
  );
  if (emailOwner.rows.length > 0 && emailOwner.rows[0].id !== studentId) {
    return {
      ok: false,
      status: 409,
      error: "This email is already associated with a different account. Update the student's email first, then try again.",
    };
  }

  await query(
    `INSERT INTO users (id, username, password_hash, role, name, email, center_id, created_at, last_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [studentId, student.email, passwordHashForNewAccount, UserRole.STUDENT, student.full_name, student.email, student.center_id]
  );
  await query(
    `INSERT INTO user_center_memberships (user_id, center_id, role)
     VALUES ($1, $2, 'STUDENT')
     ON CONFLICT (user_id, center_id, role) DO NOTHING`,
    [studentId, student.center_id]
  );

  return { ok: true, email: student.email, name: student.full_name, created: true };
}

export const adminResetStudentPassword = async (
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

    // Express 5's ParamsDictionary types every param as `string | string[]`
    // (to support its new wildcard `*name` route params, which can capture
    // multiple segments). This route only ever matches a single `:id` segment,
    // but the type is shared, so narrow it explicitly.
    const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { newPassword } = req.body;

    // Validate new password
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const newHash = await hashPassword(newPassword);
    const resolution = await resolveStudentAccount(studentId, role, req.tenantCenterId, newHash);

    if (!resolution.ok) {
      res.status(resolution.status).json({ error: resolution.error });
      return;
    }

    if (!resolution.created) {
      // Account already existed — the helper above only sets the password on
      // a *newly created* account, so set it explicitly here.
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, studentId]);
    }

    res.status(200).json({
      message: resolution.created
        ? 'Login account created and password set successfully'
        : 'Password reset successfully',
      newPassword,
    });
  } catch (error) {
    console.error('[PASSWORD] Admin reset student password error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * POST /api/students/:id/send-reset-email
 * Admin or HEAD_COACH triggers a password-reset email for a student, instead
 * of setting the password manually. Unlike the public forgot-password
 * endpoint (which always returns the same generic response to avoid leaking
 * which emails are registered), this is authenticated and scoped to one
 * specific, already-visible student, so there's no enumeration concern —
 * the admin gets a real success/failure back, which is exactly what was
 * missing when this whole class of bug first showed up as a silent no-op.
 */
export const sendStudentResetEmail = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { role } = req.user;
    if (role !== UserRole.ADMIN && role !== UserRole.HEAD_COACH) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }

    // Express 5's ParamsDictionary types every param as `string | string[]`
    // (to support its new wildcard `*name` route params, which can capture
    // multiple segments). This route only ever matches a single `:id` segment,
    // but the type is shared, so narrow it explicitly.
    const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // If the account needs to be created here, it needs *some* password —
    // the student overwrites it via the emailed link, so a random one is fine.
    const randomHash = await hashPassword(generateResetToken());
    const resolution = await resolveStudentAccount(studentId, role, req.tenantCenterId, randomHash);

    if (!resolution.ok) {
      res.status(resolution.status).json({ error: resolution.error });
      return;
    }

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [studentId]);
    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [studentId, tokenHash, expiresAt.toISOString()]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to: resolution.email,
        resetLink,
        userName: resolution.name,
        rethrowOnError: true,
      });
    } catch (emailError) {
      console.error(`[PASSWORD] Failed to send reset email to student ${studentId}:`, emailError);
      res.status(502).json({
        error: `Could not send the email to ${resolution.email}. Check the SMTP configuration and try again.`,
      });
      return;
    }

    res.status(200).json({ message: `Reset email sent to ${resolution.email}.`, email: resolution.email });
  } catch (error) {
    console.error('[PASSWORD] Send student reset email error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

/**
 * POST /api/coaches/:id/send-reset-email
 * Same idea as sendStudentResetEmail, but for coaches — whose users row
 * always already exists (created synchronously at coach-creation time), so
 * no account self-healing is needed here.
 */
export const sendCoachResetEmail = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { role } = req.user;
    if (role !== UserRole.ADMIN && role !== UserRole.HEAD_COACH) {
      res.status(403).json({ error: 'You do not have permission to perform this action' });
      return;
    }

    const coachId = req.params.id;
    const targetResult = await query(
      'SELECT id, name, email, center_id FROM users WHERE id = $1',
      [coachId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    const coach = targetResult.rows[0];

    if (role === UserRole.HEAD_COACH && coach.center_id !== req.tenantCenterId) {
      res.status(403).json({ error: 'You can only manage coaches in your center' });
      return;
    }

    if (!coach.email) {
      res.status(400).json({ error: 'This coach has no email on file. Add one in their profile, then try again.' });
      return;
    }

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [coachId]);
    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [coachId, tokenHash, expiresAt.toISOString()]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    try {
      await sendPasswordResetEmail({
        to: coach.email,
        resetLink,
        userName: coach.name,
        rethrowOnError: true,
      });
    } catch (emailError) {
      console.error(`[PASSWORD] Failed to send reset email to coach ${coachId}:`, emailError);
      res.status(502).json({
        error: `Could not send the email to ${coach.email}. Check the SMTP configuration and try again.`,
      });
      return;
    }

    res.status(200).json({ message: `Reset email sent to ${coach.email}.`, email: coach.email });
  } catch (error) {
    console.error('[PASSWORD] Send coach reset email error:', error);
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

    // Look up user by email, case-insensitively — matches how every other
    // email lookup in this codebase works (coaches.ts, students.ts,
    // admin/centers.ts, admin/coachActions.ts all use LOWER(email)).
    // An exact-case match here silently misses accounts whose stored email
    // casing differs from what the person typed, and because this endpoint
    // always returns the same generic success message (by design, to avoid
    // leaking which emails are registered), that miss is invisible — it
    // just looks like "the email never arrived."
    const userResult = await query(
      'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1)',
      [typeof email === 'string' ? email.trim() : email]
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
