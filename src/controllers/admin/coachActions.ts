import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { generateResetToken, hashToken } from '../../utils/tokenGenerator';
import { sendPasswordResetEmail } from '../../services/emailService';
import { sendCenterWelcomeEmail } from '../../services/welcomeEmailService';

/**
 * Resolves (or creates) the center owner account from the center's contact_email.
 *
 * This is purely a center-account concept — no "head coach" terminology.
 * The center owner is the person who logs in with the center's contact email.
 *
 * Flow:
 *  1. Load center — must exist and have a contact_email.
 *  2. Look up existing user by email.
 *  3. If not found, auto-create a HEAD_COACH user from the contact email.
 *  4. Ensure head_coach_id and membership are set on the center.
 *  5. Return the owner record.
 */
async function resolveCenterOwner(
  centerId: string,
  res: Response
): Promise<{ id: string; name: string; email: string } | null> {

  // 1. Load center
  const centerResult = await query(
    'SELECT id, name, head_coach_id, contact_email FROM centers WHERE id = $1',
    [centerId]
  );

  if (centerResult.rows.length === 0) {
    res.status(404).json({ error: 'Center not found' });
    return null;
  }

  const center = centerResult.rows[0];

  if (!center.contact_email) {
    res.status(422).json({ error: 'This center has no contact email set. Please edit the center and add a contact email first.' });
    return null;
  }

  const ownerEmail = center.contact_email.trim().toLowerCase();

  // 2. Look up existing user by email
  let owner: { id: string; name: string; email: string } | null = null;

  // First try head_coach_id if already set (fast path)
  if (center.head_coach_id) {
    const ownerResult = await query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [center.head_coach_id]
    );
    if (ownerResult.rows.length > 0) {
      owner = ownerResult.rows[0];
    }
  }

  // Fall back to email lookup
  if (!owner) {
    const emailResult = await query(
      'SELECT id, name, email FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
      [ownerEmail]
    );
    if (emailResult.rows.length > 0) {
      owner = emailResult.rows[0];
    }
  }

  // 3. Auto-create user if still not found
  // password_hash is NOT NULL — use a locked placeholder ('!') that bcrypt will never match
  if (!owner) {
    const newUser = await query(
      `INSERT INTO users (username, email, password_hash, role, name, center_id, created_at, last_active)
       VALUES ($1, $2, '!', 'HEAD_COACH', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email`,
      [ownerEmail, ownerEmail, center.name || ownerEmail, centerId]
    );
    owner = newUser.rows[0];
    console.log(`[CenterOwner] Auto-created user for ${ownerEmail}`);
  }

  // 4. Ensure center.head_coach_id and membership are in sync
  if (!center.head_coach_id || center.head_coach_id !== owner!.id) {
    await query('UPDATE centers SET head_coach_id = $1 WHERE id = $2', [owner!.id, centerId]);
  }
  await query(
    `INSERT INTO user_center_memberships (user_id, center_id, role)
     VALUES ($1, $2, 'HEAD_COACH')
     ON CONFLICT (user_id, center_id, role) DO NOTHING`,
    [owner!.id, centerId]
  );

  return owner;
}

/**
 * POST /api/admin/centers/:id/invite-coach
 *
 * Sends (or re-sends) a welcome invite email to the center owner.
 * The recipient is always the center's contact_email.
 * Creates a user account automatically if one doesn't exist yet.
 */
export const inviteCoach = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.params.id as string;
    const owner = await resolveCenterOwner(centerId, res);
    if (!owner) return; // Response already sent

    // Get center name
    const centerResult = await query('SELECT name FROM centers WHERE id = $1', [centerId]);
    const centerName = centerResult.rows[0]?.name || 'your center';

    // Generate 24-hour password setup token
    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [owner.id]);
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [owner.id, tokenHash, expiresAt.toISOString()]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
    const loginUrl = `${frontendUrl}/login`;

    await sendCenterWelcomeEmail({
      centerName,
      headCoachEmail: owner.email,
      userName: owner.name || owner.email,
      resetLink,
      loginUrl,
      centerId,
    });

    res.status(200).json({
      success: true,
      message: `Invite email sent to ${owner.email}`,
    });
  } catch (error) {
    console.error('[ADMIN] inviteCoach error:', error);
    res.status(500).json({ error: 'An error occurred while sending the invite' });
  }
};

/**
 * POST /api/admin/centers/:id/reset-coach-password
 *
 * Sends a password reset email to the center owner.
 */
export const resetCoachPassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.params.id as string;
    const owner = await resolveCenterOwner(centerId, res);
    if (!owner) return;

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [owner.id]);

    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [owner.id, tokenHash, expiresAt.toISOString()]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to: owner.email,
      resetLink,
      userName: owner.name,
    });

    res.status(200).json({
      success: true,
      message: `Password reset email sent to ${owner.email}`,
    });
  } catch (error) {
    console.error('[ADMIN] resetCoachPassword error:', error);
    res.status(500).json({ error: 'An error occurred while sending the password reset' });
  }
};
