import nodemailer from 'nodemailer';

interface SendResetEmailParams {
  to: string;
  resetLink: string;
  userName: string;
}

function createTransporter() {
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  console.log(`[EmailService] SMTP config — host:${process.env.SMTP_HOST} port:${port} user:${process.env.SMTP_USER ? process.env.SMTP_USER : 'MISSING'}`);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends a password reset email with the provided reset link.
 * Errors are logged internally but never thrown — this prevents
 * enumeration leaks via timing differences.
 */
export async function sendPasswordResetEmail({
  to,
  resetLink,
  userName,
}: SendResetEmailParams): Promise<void> {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@shuttlecoach.app',
      to,
      subject: 'Reset Your Password - ShuttleCoach',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${userName},</p>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <p style="margin: 24px 0;">
            <a href="${resetLink}" 
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #6B7280;">${resetLink}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request a password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
          <p style="color: #9CA3AF; font-size: 12px;">ShuttleCoach — Badminton Coaching Management</p>
        </div>
      `,
    });
    console.log(`[EmailService] Password reset sent to:${to} messageId:${info.messageId}`);
  } catch (error: any) {
    console.error(`[EmailService] Failed to send password reset — code:${error.code} response:${error.response} message:${error.message}`);
    // Intentionally swallowed — do not throw to prevent enumeration leaks
  }
}
