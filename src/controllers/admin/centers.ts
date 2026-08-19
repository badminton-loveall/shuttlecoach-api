import { Response } from 'express';
import { query } from '../../config/database';
import { UserRole } from '../../types';
import { AuthRequest } from '../../middleware/auth';
import { validateSlug, generateSlug } from '../../utils/slug';
import { generateResetToken, hashToken } from '../../utils/tokenGenerator';
import { sendCenterWelcomeEmail } from '../../services/welcomeEmailService';

/**
 * GET /api/admin/centers
 * List all centers
 */
export const listCenters = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT
        id, name, location, contact_phone, contact_email, logo_url,
        is_active, head_coach_id, plan_type, subscription_expires_at,
        sport, created_at, updated_at
       FROM centers
       ORDER BY created_at DESC`
    );

    const centers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      location: row.location,
      contactPhone: row.contact_phone,
      contactEmail: row.contact_email,
      logoUrl: row.logo_url,
      isActive: row.is_active,
      headCoachId: row.head_coach_id,
      planType: row.plan_type,
      subscriptionExpiresAt: row.subscription_expires_at,
      sport: row.sport,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.status(200).json(centers);
  } catch (error) {
    console.error('List centers error:', error);
    res.status(500).json({ error: 'An error occurred while fetching centers' });
  }
};

/**
 * POST /api/admin/centers
 * Create a new center. Enforces name uniqueness (409 on duplicate).
 */
export const createCenter = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, location, contactPhone, contactEmail, logoUrl, planType, subscriptionExpiresAt, headCoachId, sport } =
      req.body;

    if (!name) {
      res.status(400).json({ error: 'Center name is required' });
      return;
    }

    // Check name uniqueness
    const existing = await query(
      'SELECT id FROM centers WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'A center with this name already exists' });
      return;
    }

    // Generate slug from center name
    const slug = generateSlug(name);

    const result = await query(
      `INSERT INTO centers (name, location, contact_phone, contact_email, logo_url, plan_type, subscription_expires_at, head_coach_id, slug, sport)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, location, contact_phone, contact_email, logo_url,
                 is_active, head_coach_id, plan_type, subscription_expires_at,
                 slug, sport, created_at, updated_at`,
      [
        name,
        location || null,
        contactPhone || null,
        contactEmail || null,
        logoUrl || null,
        planType || 'basic',
        subscriptionExpiresAt || null,
        headCoachId || null,
        slug,
        sport || null,
      ]
    );

    const center = result.rows[0];

    // Insert onboarding checklist row (non-blocking — failure should not fail center creation)
    try {
      await query(
        'INSERT INTO center_onboarding_checklists (center_id) VALUES ($1)',
        [center.id]
      );
    } catch (checklistError) {
      console.error(`[CreateCenter] Failed to create onboarding checklist for center ${center.id}:`, checklistError);
    }

    // Auto-create center owner account from contactEmail and send welcome email.
    // Runs inline (not fire-and-forget) so errors are visible in logs.
    // Failure here is non-fatal — center is already created; admin can resend invite.
    if (contactEmail) {
      try {
        const ownerEmail = contactEmail.trim().toLowerCase();

        // Find or create user with this email
        let ownerId: string;
        let ownerName: string;
        const existingOwner = await query(
          'SELECT id, username, name FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
          [ownerEmail]
        );

        if (existingOwner.rows.length > 0) {
          ownerId = existingOwner.rows[0].id;
          ownerName = existingOwner.rows[0].name || existingOwner.rows[0].username;
        } else {
          const newUser = await query(
            `INSERT INTO users (username, email, password_hash, role, name, center_id, created_at, last_active)
             VALUES ($1, $2, '!', 'HEAD_COACH', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id, username, name`,
            [ownerEmail, ownerEmail, name, center.id]
          );
          ownerId = newUser.rows[0].id;
          ownerName = newUser.rows[0].name || newUser.rows[0].username;
        }

        // Assign as head coach and ensure membership
        await query('UPDATE centers SET head_coach_id = $1 WHERE id = $2', [ownerId, center.id]);
        await query(
          `INSERT INTO user_center_memberships (user_id, center_id, role)
           VALUES ($1, $2, 'HEAD_COACH')
           ON CONFLICT (user_id, center_id, role) DO NOTHING`,
          [ownerId, center.id]
        );

        // Generate 24-hour password setup token
        const rawToken = generateResetToken();
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [ownerId]);
        await query(
          'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
          [ownerId, tokenHash, expiresAt.toISOString()]
        );

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
        const loginUrl = `${frontendUrl}/login`;

        await sendCenterWelcomeEmail({
          centerName: center.name,
          headCoachEmail: ownerEmail,
          userName: ownerName,
          resetLink,
          loginUrl,
          centerId: center.id,
        });

        console.log(`[CreateCenter] Welcome email sent to ${ownerEmail} for center ${center.id}`);
      } catch (ownerError) {
        // Log but don't fail the request — center was created; admin can resend invite
        console.error(`[CreateCenter] Failed to create owner account / send welcome email for center ${center.id}:`, ownerError);
      }
    }

    res.status(201).json({
      id: center.id,
      name: center.name,
      location: center.location,
      contactPhone: center.contact_phone,
      contactEmail: center.contact_email,
      logoUrl: center.logo_url,
      isActive: center.is_active,
      headCoachId: center.head_coach_id,
      planType: center.plan_type,
      subscriptionExpiresAt: center.subscription_expires_at,
      sport: center.sport,
      createdAt: center.created_at,
      updatedAt: center.updated_at,
    });
  } catch (error) {
    console.error('Create center error:', error);
    res.status(500).json({ error: 'An error occurred while creating the center' });
  }
};

/**
 * PATCH /api/admin/centers/:id
 * Update only specified fields for a center.
 */
export const updateCenter = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const allowedFields: Record<string, string> = {
      name: 'name',
      location: 'location',
      contactPhone: 'contact_phone',
      contactEmail: 'contact_email',
      logoUrl: 'logo_url',
      isActive: 'is_active',
      planType: 'plan_type',
      subscriptionExpiresAt: 'subscription_expires_at',
      slug: 'slug',
      sport: 'sport',
    };

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [bodyKey, dbColumn] of Object.entries(allowedFields)) {
      if (req.body[bodyKey] !== undefined) {
        setClauses.push(`${dbColumn} = $${paramIndex}`);
        values.push(req.body[bodyKey]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // If name is being updated, check uniqueness
    if (req.body.name !== undefined) {
      const existing = await query(
        'SELECT id FROM centers WHERE LOWER(name) = LOWER($1) AND id != $2',
        [req.body.name, id]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'A center with this name already exists' });
        return;
      }
    }

    // If slug is being updated, validate format and check uniqueness
    if (req.body.slug !== undefined) {
      const slugValidation = validateSlug(req.body.slug);
      if (!slugValidation.valid) {
        res.status(400).json({ error: slugValidation.error });
        return;
      }

      const existingSlug = await query(
        'SELECT id FROM centers WHERE slug = $1 AND id != $2',
        [req.body.slug, id]
      );
      if (existingSlug.rows.length > 0) {
        res.status(409).json({ error: 'This slug is already taken' });
        return;
      }
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    values.push(id);
    const idParam = `$${paramIndex}`;

    const result = await query(
      `UPDATE centers SET ${setClauses.join(', ')} WHERE id = ${idParam}
       RETURNING id, name, location, contact_phone, contact_email, logo_url,
                 is_active, head_coach_id, plan_type, subscription_expires_at,
                 slug, sport, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Center not found' });
      return;
    }

    const center = result.rows[0];

    res.status(200).json({
      id: center.id,
      name: center.name,
      location: center.location,
      contactPhone: center.contact_phone,
      contactEmail: center.contact_email,
      logoUrl: center.logo_url,
      isActive: center.is_active,
      headCoachId: center.head_coach_id,
      planType: center.plan_type,
      subscriptionExpiresAt: center.subscription_expires_at,
      slug: center.slug,
      sport: center.sport,
      createdAt: center.created_at,
      updatedAt: center.updated_at,
    });
  } catch (error) {
    console.error('Update center error:', error);
    res.status(500).json({ error: 'An error occurred while updating the center' });
  }
};

/**
 * GET /api/admin/centers/:id/stats
 * Return per-center statistics: student count, coach count, revenue.
 */
export const getCenterStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify center exists
    const centerResult = await query(
      'SELECT id, name FROM centers WHERE id = $1',
      [id]
    );

    if (centerResult.rows.length === 0) {
      res.status(404).json({ error: 'Center not found' });
      return;
    }

    // Student count
    const studentsResult = await query(
      'SELECT COUNT(*) as count FROM students WHERE center_id = $1',
      [id]
    );

    // Coach count (HEAD_COACH + ASSISTANT_COACH)
    const coachesResult = await query(
      `SELECT COUNT(*) as count FROM users
       WHERE center_id = $1 AND role IN ($2, $3)`,
      [id, UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH]
    );

    // Total revenue (sum of paid fee records)
    const revenueResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM fee_records
       WHERE center_id = $1 AND status = 'PAID'`,
      [id]
    );

    res.status(200).json({
      centerId: id,
      centerName: centerResult.rows[0].name,
      studentCount: parseInt(studentsResult.rows[0].count, 10),
      coachCount: parseInt(coachesResult.rows[0].count, 10),
      totalRevenue: parseFloat(revenueResult.rows[0].total),
    });
  } catch (error) {
    console.error('Get center stats error:', error);
    res.status(500).json({ error: 'An error occurred while fetching center statistics' });
  }
};
