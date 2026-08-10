import nodemailer from 'nodemailer';

interface SendCenterWelcomeEmailParams {
  centerName: string;
  headCoachEmail: string;
  userName: string;
  resetLink: string;
  loginUrl: string;
  centerId?: string;
}

interface SendCoachWelcomeEmailParams {
  coachEmail: string;
  coachName: string;
  coachUsername: string;
  centerName: string;
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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header with brand -->
      <div style="background-color: #111827; padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <span style="font-size: 24px; font-weight: 700; color: #B8E135; letter-spacing: -0.5px;">LoveAll</span>
              <span style="font-size: 14px; color: #9CA3AF; margin-left: 8px;">by ShuttleCoach</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main content -->
      <div style="padding: 40px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
        <!-- Welcome -->
        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">Welcome aboard, ${userName}! 🏸</h1>
        <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
          Your center <strong style="color: #111827;">${centerName}</strong> is ready. You've been assigned as the Head Coach — let's get everything set up.
        </p>

        <!-- Set Password CTA -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">🔐 Set your password</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 16px 0;">Click below to create your password. This link expires in 24 hours.</p>
          <a href="${resetLink}"
             style="display: inline-block; background-color: #B8E135; color: #111827; font-size: 14px; font-weight: 600; padding: 12px 28px; text-decoration: none; border-radius: 8px; letter-spacing: 0.2px;">
            Set Password →
          </a>
          <p style="font-size: 12px; color: #9CA3AF; margin: 12px 0 0 0; word-break: break-all;">${resetLink}</p>
        </div>

        <!-- Login URL -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">🔗 Your login</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 8px 0;">Once your password is set, log in here:</p>
          <a href="${loginUrl}" style="font-size: 14px; color: #B8E135; font-weight: 500; text-decoration: none;">${loginUrl}</a>
        </div>

        <!-- Onboarding Checklist -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">📋 Your setup checklist</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 16px 0;">Complete these steps to get your center fully operational. You'll find a live checklist on your dashboard.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">1</span>
                <span style="color: #374151;">Add coaches to your team</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">2</span>
                <span style="color: #374151;">Add your students</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">3</span>
                <span style="color: #374151;">Set up your curriculum</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">4</span>
                <span style="color: #374151;">Create batch templates</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">5</span>
                <span style="color: #374151;">Create batches</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">6</span>
                <span style="color: #374151;">Assign students to coaches/batches</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Help -->
        <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5; margin: 0;">
          Need help? Reply to this email or reach out to our support team. We're here to help you succeed.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 20px 40px;">
        <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
          © ${new Date().getFullYear()} LoveAll by ShuttleCoach · Badminton Coaching Management
        </p>
      </div>
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

/**
 * Renders the coach welcome email HTML template.
 * Exported separately to enable property-based testing of the template content.
 */
export function renderCoachWelcomeEmailHtml({
  coachName,
  coachUsername,
  centerName,
  resetLink,
  loginUrl,
}: {
  coachName: string;
  coachUsername: string;
  centerName: string;
  resetLink: string;
  loginUrl: string;
}): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header with brand -->
      <div style="background-color: #111827; padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <span style="font-size: 24px; font-weight: 700; color: #B8E135; letter-spacing: -0.5px;">LoveAll</span>
              <span style="font-size: 14px; color: #9CA3AF; margin-left: 8px;">by ShuttleCoach</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main content -->
      <div style="padding: 40px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
        <!-- Welcome -->
        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">Welcome, ${coachName}! 🏸</h1>
        <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
          You've been added as an assistant coach at <strong style="color: #111827;">${centerName}</strong>. Here's everything you need to get started.
        </p>

        <!-- Username -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">👤 Your username</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 4px 0;">Use this to log in:</p>
          <p style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">${coachUsername}</p>
        </div>

        <!-- Set Password CTA -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">🔐 Set your password</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 16px 0;">Click below to create your password. This link expires in 24 hours.</p>
          <a href="${resetLink}"
             style="display: inline-block; background-color: #B8E135; color: #111827; font-size: 14px; font-weight: 600; padding: 12px 28px; text-decoration: none; border-radius: 8px; letter-spacing: 0.2px;">
            Set Password →
          </a>
          <p style="font-size: 12px; color: #9CA3AF; margin: 12px 0 0 0; word-break: break-all;">${resetLink}</p>
        </div>

        <!-- Login URL -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">🔗 Your login</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 8px 0;">Once your password is set, log in here:</p>
          <a href="${loginUrl}" style="font-size: 14px; color: #B8E135; font-weight: 500; text-decoration: none;">${loginUrl}</a>
        </div>

        <!-- Coach Capabilities Guide -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">📋 What you can do</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0 0 16px 0;">As an assistant coach, you have access to the following capabilities:</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px;">
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">1</span>
                <span style="color: #374151;">View assigned students</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">2</span>
                <span style="color: #374151;">Mark attendance</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border-bottom: 1px solid #F3F4F6;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">3</span>
                <span style="color: #374151;">Log training sessions</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 12px;">
                <span style="display: inline-block; width: 22px; height: 22px; background-color: #F3F4F6; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px; font-weight: 600; color: #6B7280; margin-right: 10px;">4</span>
                <span style="color: #374151;">Record assessments</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Help -->
        <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5; margin: 0;">
          Need help? Reply to this email or reach out to our support team. We're here to help you succeed.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 20px 40px;">
        <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
          © ${new Date().getFullYear()} LoveAll by ShuttleCoach · Badminton Coaching Management
        </p>
      </div>
    </div>
  `;
}

/**
 * Sends a welcome email to a newly created assistant coach.
 *
 * Behavior:
 * - Validates email format; on invalid email, logs warning and returns without throwing.
 * - On transient SMTP failure, retries once after a 5-second delay.
 * - If retry also fails, logs error and returns without throwing.
 */
export async function sendCoachWelcomeEmail({
  coachEmail,
  coachName,
  coachUsername,
  centerName,
  resetLink,
  loginUrl,
  centerId,
}: SendCoachWelcomeEmailParams): Promise<void> {
  // Validate email
  if (!isValidEmail(coachEmail)) {
    console.warn(
      `[WelcomeEmail] Invalid email address for coach at center ${centerId || 'unknown'}. Skipping delivery.`
    );
    return;
  }

  const html = renderCoachWelcomeEmailHtml({ coachName, coachUsername, centerName, resetLink, loginUrl });

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@shuttlecoach.app',
    to: coachEmail.trim(),
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
        `[WelcomeEmail] Failed to send coach welcome email for center ${centerId || 'unknown'} after retry:`,
        retryError
      );
      // Return without throwing — never block coach creation
    }
  }
}

// --- Student Welcome Email ---

interface SendStudentWelcomeEmailParams {
  studentEmail: string;
  studentName: string;
  centerName: string;
  batchName?: string;
  centerContactInfo: string;
  guardianName?: string;
  isMinor: boolean;
  centerId?: string;
}

/**
 * Renders the student welcome email HTML template.
 * Exported separately to enable property-based testing of the template content.
 *
 * When `isMinor` is true and `guardianName` is provided, the greeting addresses
 * the guardian instead of the student.
 */
export function renderStudentWelcomeEmailHtml({
  studentName,
  centerName,
  batchName,
  centerContactInfo,
  guardianName,
  isMinor,
}: {
  studentName: string;
  centerName: string;
  batchName?: string;
  centerContactInfo: string;
  guardianName?: string;
  isMinor: boolean;
}): string {
  const greeting =
    isMinor && guardianName ? `Dear ${guardianName}` : `Dear ${studentName}`;

  const batchSection = batchName
    ? `
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">🏸 Assigned Batch</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0;">${batchName}</p>
        </div>`
    : '';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header with brand -->
      <div style="background-color: #111827; padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td>
              <span style="font-size: 24px; font-weight: 700; color: #B8E135; letter-spacing: -0.5px;">LoveAll</span>
              <span style="font-size: 14px; color: #9CA3AF; margin-left: 8px;">by ShuttleCoach</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main content -->
      <div style="padding: 40px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 12px 12px;">
        <!-- Welcome -->
        <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px 0;">${greeting}! 🏸</h1>
        <p style="font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
          ${isMinor && guardianName ? `We're pleased to let you know that <strong style="color: #111827;">${studentName}</strong> has been enrolled` : `You have been enrolled`} at <strong style="color: #111827;">${centerName}</strong>. Welcome to the coaching program!
        </p>

        <!-- Enrolment Confirmation -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">✅ Enrolment Confirmed</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0;">
            <strong>Student:</strong> ${studentName}<br/>
            <strong>Center:</strong> ${centerName}
          </p>
        </div>
${batchSection}
        <!-- Contact Info -->
        <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">📞 Center Contact</h2>
          <p style="font-size: 14px; color: #6B7280; margin: 0;">If you have any questions, please reach out:</p>
          <p style="font-size: 14px; color: #374151; margin: 8px 0 0 0;">${centerContactInfo}</p>
        </div>

        <!-- Help -->
        <p style="font-size: 13px; color: #9CA3AF; line-height: 1.5; margin: 0;">
          Need help? Reply to this email or contact your center directly. We're here to help you succeed.
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 20px 40px;">
        <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
          © ${new Date().getFullYear()} LoveAll by ShuttleCoach · Badminton Coaching Management
        </p>
      </div>
    </div>
  `;
}

/**
 * Sends a welcome email to a newly enrolled student (or their guardian).
 *
 * Behavior:
 * - Validates email format; on invalid email, logs warning and returns without throwing.
 * - On transient SMTP failure, retries once after a 5-second delay.
 * - If retry also fails, logs error and returns without throwing.
 */
export async function sendStudentWelcomeEmail({
  studentEmail,
  studentName,
  centerName,
  batchName,
  centerContactInfo,
  guardianName,
  isMinor,
  centerId,
}: SendStudentWelcomeEmailParams): Promise<void> {
  // Validate email
  if (!isValidEmail(studentEmail)) {
    console.warn(
      `[WelcomeEmail] Invalid student email address for center ${centerId || 'unknown'}. Skipping delivery.`
    );
    return;
  }

  const html = renderStudentWelcomeEmailHtml({
    studentName,
    centerName,
    batchName,
    centerContactInfo,
    guardianName,
    isMinor,
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || 'noreply@shuttlecoach.app',
    to: studentEmail.trim(),
    subject: `Welcome to ${centerName} — ShuttleCoach`,
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
        `[WelcomeEmail] Failed to send student welcome email for center ${centerId || 'unknown'} after retry:`,
        retryError
      );
      // Return without throwing — never block student creation
    }
  }
}
