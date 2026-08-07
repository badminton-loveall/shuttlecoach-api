import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { generateResetToken, hashToken } from '../../utils/tokenGenerator';
import { sendPasswordResetEmail } from '../../services/emailService';

/**
 * Shared helper: resolve head coach for a given center.
 * Returns the head coach user row or sends an error response and returns null.
 */
async function resolveHeadCoach(
  centerId: string,
  res: Response
): Promise<{ id: string; name: string; email: string } | null> {
  // 1. Verify center exists
  const centerResult = await query(
    'SELECT id, name, head_coach_id FROM centers WHERE id = $1',
    [centerId]
  );

  if (centerResult.rows.length === 0) {
    res.status(404).json({ error: 'Center not found' });
    return null;
  }

  const center = centerResult.rows[0];

  // 2. Check if head coach is assigned
  if (!center.head_coach_id) {
    res.status(422).json({ error: 'No head coach is assigned to this center' });
    return null;
  }

  // 3. Look up the head coach user to get their email
  const coachResult = await query(
    'SELECT id, name, email FROM users WHERE id = $1',
    [center.head_coach_id]
  );

  if (coachResult.rows.length === 0) {
    res.status(422).json({ error: 'Head coach user not found' });
    return null;
  }

  const coach = coachResult.rows[0];

  // 4. Validate email exists
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

    // Build invite link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/login`;

    // Send invite email (reuse email service pattern; swallows errors internally)
    try {
      const { default: nodemailer } = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@shuttlecoach.app',
        to: coach.email,
        subject: 'You\'re Invited to ShuttleCoach',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ShuttleCoach!</h2>
            <p>Hi ${coach.name},</p>
            <p>You have been invited as the Head Coach on ShuttleCoach. Click below to get started:</p>
            <p style="margin: 24px 0;">
              <a href="${inviteLink}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Log In to ShuttleCoach
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6B7280;">${inviteLink}</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
            <p style="color: #9CA3AF; font-size: 12px;">ShuttleCoach — Badminton Coaching Management</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('[ADMIN] Failed to send invite email:', emailError);
      // Continue — email failure is non-blocking
    }

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
