import nodemailer from 'nodemailer';

interface SendCenterWelcomeEmailParams {
  centerName: string;
  headCoachEmail: string;
  userName: string;
  resetLink: string;
  loginUrl: string;
  centerId?: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Validates that an email address is non-empty, non-whitespace, and has
 * a basic format: contains "@" with at least one character on each side
 * and a "." in the domain portion.
 */
function isValidEmail(email: string | null | undefined): boolean {
  if (!email || email.trim().length === 0) {
    return false;
  }
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex < 1) {
    return false;
  }
  const domain = trimmed.slice(atIndex + 1);
  if (!domain || domain.length === 0 || !domain.includes('.')) {
    return false;
  }
  // Ensure there's at least one char before and after the dot in domain
  const dotIndex = domain.indexOf('.');
  if (dotIndex < 1 || dotIndex === domain.length - 1) {
    return false;
  }
  return true;
}

/**
 * Renders the welcome email HTML template.
 * Exported separately to enable property-based testing of the template content.
 */
export function renderWelcomeEmailHtml({
  centerName,
  userName,
  resetLink,
  loginUrl,
}: {
  centerName: string;
  userName: string;
  resetLink: string;
  loginUrl: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1F2937;">Welcome to ShuttleCoach!</h2>
      <p>Hi ${userName},</p>
      <p>Your center <strong>${centerName}</strong> has been created and you've been assigned as the Head Coach. Let's get you set up!</p>

      <h3 style="color: #4F46E5;">Set Your Password</h3>
      <p>To get started, please set your password by clicking the button below. This link expires in 24 hours.</p>
      <p style="margin: 24px 0;">
        <a href="${resetLink}"
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Set Password
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #6B7280;">${resetLink}</p>

      <h3 style="color: #4F46E5;">Your Center Login</h3>
      <p>Once your password is set, log in at:</p>
      <p style="word-break: break-all;"><a href="${loginUrl}" style="color: #4F46E5;">${loginUrl}</a></p>

      <h3 style="color: #4F46E5;">Getting Started — Your Onboarding Checklist</h3>
      <p>After logging in, complete these steps to get your center fully operational:</p>
      <ol style="line-height: 2; color: #374151;">
        <li>Add coaches</li>
        <li>Add students</li>
        <li>Set up curriculum</li>
        <li>Create batch templates</li>
        <li>Create batches</li>
        <li>Assign students to coaches/batches</li>
      </ol>
      <p>You'll find a checklist on your dashboard to track your progress through these steps.</p>

      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
      <p style="color: #9CA3AF; font-size: 12px;">ShuttleCoach — Badminton Coaching Management</p>
    </div>
  `;
}

/**
 * Sends a welcome email to the newly assigned head coach of a center.
 *
 * Behavior:
 * - Validates email format; on invalid email, logs warning and returns without throwing.
 * - On transient SMTP failure, retries once after a 5-second delay.
 * - If retry also fails, logs error and returns without throwing.
 */
export async function sendCenterWelcomeEmail({
  centerName,
  headCoachEmail,
  userName,
  resetLink,
  loginUrl,
  centerId,
}: SendCenterWelcomeEmailParams): Promise<void> {
  // Validate email
  if (!isValidEmail(headCoachEmail)) {
    console.warn(
      `[WelcomeEmail] Invalid email address for center ${centerId || 'unknown'}. Skipping delivery.`
    );
    return;
  }

  const html = renderWelcomeEmailHtml({ centerName, userName, resetLink, loginUrl });

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@shuttlecoach.app',
    to: headCoachEmail.trim(),
    subject: `Welcome to ShuttleCoach — ${centerName}`,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (firstError) {
    // Retry once after 5-second delay for transient failures
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      await transporter.sendMail(mailOptions);
    } catch (retryError) {
      console.error(
        `[WelcomeEmail] Failed to send welcome email for center ${centerId || 'unknown'} after retry:`,
        retryError
      );
      // Return without throwing — never block center creation
    }
  }
}
