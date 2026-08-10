import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { generateResetToken, hashToken } from '../../utils/tokenGenerator';
import { sendPasswordResetEmail } from '../../services/emailService';
import { sendCenterWelcomeEmail } from '../../services/welcomeEmailService';

/**
 * Shared helper: resolve head coach for a given center.
 * Returns the head coach user row or sends an error response and returns null.
 * If no head_coach_id is set but contactEmail exists, looks up the user by contactEmail.
 */
async function resolveHeadCoach(
  centerId: string,
  res: Response
): Promise<{ id: string; name: string; email: string } | null> {
  // 1. Verify center exists
  const centerResult = await query(
    'SELECT id, name, head_coach_id, contact_email FROM centers WHERE id = $1',
    [centerId]
  );

  if (centerResult.rows.length === 0) {
    res.status(404).json({ error: 'Center not found' });
    return null;
  }

  const center = centerResult.rows[0];

  // 2. Try head_coach_id first, then fall back to contact_email lookup
  let coach: { id: string; name: string; email: string } | null = null;

  if (center.head_coach_id) {
    const coachResult = await query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [center.head_coach_id]
    );
    if (coachResult.rows.length > 0) {
      coach = coachResult.rows[0];
    }
  }

  // Fallback: look up user by center's contact_email
  if (!coach && center.contact_email) {
    const ownerEmail = center.contact_email.trim().toLowerCase();
    const coachResult = await query(
      'SELECT id, name, email FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
      [ownerEmail]
    );
    if (coachResult.rows.length > 0) {
      coach = coachResult.rows[0];
      // Ensure center has head_coach_id set
      if (!center.head_coach_id) {
        await query('UPDATE centers SET head_coach_id = $1 WHERE id = $2', [coach!.id, centerId]);
      }
      // Ensure membership exists
      await query(
        `INSERT INTO user_center_memberships (user_id, center_id, role)
         VALUES ($1, $2, 'HEAD_COACH')
         ON CONFLICT (user_id, center_id, role) DO NOTHING`,
        [coach!.id, centerId]
      );
    } else {
      // Auto-create the user from contactEmail
      try {
        const newUser = await query(
          `INSERT INTO users (username, email, role, name, center_id, created_at, last_active)
           VALUES ($1, $2, 'HEAD_COACH', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING id, name, email`,
          [ownerEmail, ownerEmail, center.name || ownerEmail, centerId]
        );
        if (newUser.rows.length > 0) {
          coach = newUser.rows[0];
          await query('UPDATE centers SET head_coach_id = $1 WHERE id = $2', [coach!.id, centerId]);
          // Create membership
          await query(
            `INSERT INTO user_center_memberships (user_id, center_id, role)
             VALUES ($1, $2, 'HEAD_COACH')
             ON CONFLICT (user_id, center_id, role) DO NOTHING`,
            [coach!.id, centerId]
          );
        }
      } catch (insertErr) {
        console.error('[resolveHeadCoach] Failed to auto-create user:', insertErr);
      }
    }
  }

  if (!coach) {
    res.status(422).json({ error: 'No head coach is assigned to this center' });
    return null;
  }

  if (!coach.email) {
    res.status(422).json({ error: 'Head coach has no email address on file' });
    return null;
  }

  return coach;
}

/**
 * POST /api/admin/centers/:id/invite-coach
 *
 * Sends an invite email to the head coach of the specified center.
 *
 * Validations:
 * - Center must exist
 * - Head coach must be assigned (422 if not)
 * - Head coach must have an email (422 if not)
 *
 * Requirements: 5.2, 5.4, 5.5
 */
export const inviteCoach = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.params.id as string;
    const coach = await resolveHeadCoach(centerId, res);

    if (!coach) return; // Response already sent by helper

    // Look up center name
    const centerResult = await query('SELECT name FROM centers WHERE id = $1', [centerId]);
    const centerName = centerResult.rows[0]?.name || 'your center';

    // Generate password reset token so they can set their password
    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate existing tokens
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [coach.id]);

    // Store hashed token
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [coach.id, tokenHash, expiresAt.toISOString()]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
    const loginUrl = `${frontendUrl}/login`;

    // Send branded welcome email
    await sendCenterWelcomeEmail({
      centerName,
      headCoachEmail: coach.email,
      userName: coach.name || coach.email,
      resetLink,
      loginUrl,
      centerId,
    });

    res.status(200).json({
      success: true,
      message: `Invite email sent to ${coach.email}`,
    });
  } catch (error) {
    console.error('[ADMIN] inviteCoach error:', error);
    res.status(500).json({ error: 'An error occurred while sending the invite' });
  }
};

/**
 * POST /api/admin/centers/:id/reset-coach-password
 *
 * Generates a password reset token and sends a reset link email
 * to the head coach of the specified center.
 *
 * Validations:
 * - Center must exist
 * - Head coach must be assigned (422 if not)
 * - Head coach must have an email (422 if not)
 *
 * Requirements: 5.3, 5.4, 5.5
 */
export const resetCoachPassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.params.id as string;
    const coach = await resolveHeadCoach(centerId, res);

    if (!coach) return; // Response already sent by helper

    // Invalidate any existing reset tokens for this coach
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [coach.id]);

    // Generate new token
    const rawToken = generateResetToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store hashed token
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [coach.id, tokenHash, expiresAt.toISOString()]
    );

    // Send email with reset link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to: coach.email,
      resetLink,
      userName: coach.name,
    });

    res.status(200).json({
      success: true,
      message: `Password reset email sent to ${coach.email}`,
    });
  } catch (error) {
    console.error('[ADMIN] resetCoachPassword error:', error);
    res.status(500).json({ error: 'An error occurred while sending the password reset' });
  }
};
