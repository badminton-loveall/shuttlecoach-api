import { Response } from 'express';
import crypto from 'crypto';
import { query } from '../config/database';
import { hashPassword } from '../utils/auth';
import { generateResetToken, hashToken } from '../utils/tokenGenerator';
import { sendCoachWelcomeEmail } from '../services/welcomeEmailService';
import { UserRole } from '../types';
import { TenantRequest } from '../middleware/tenantScope';
import { createMembership, getMembership, removeMembership } from '../services/membershipService';
import { getEffectiveCapacity } from '../services/subscriptionService';

/**
 * Validates whether a string is a valid UUID v4 format.
 */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * POST /api/coaches
 * Create a new assistant coach account (Head Coach only)
 */
export const createCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      name, username, password, specialization, profilePhoto, email, seniorCoachId,
      phone, dateOfBirth, address, qualification, experienceYears, bankDetails, monthlySalary,
    } = req.body;

    // Validate required fields
    if (!name || !username) {
      res.status(400).json({
        error: 'Name and username (email) are required',
      });
      return;
    }

    // Coach Capacity is a marketplace item — a center with no active
    // subscription still gets the catalog's free baseline seats. Checked
    // before either creation path below (brand-new coach, or granting an
    // existing user membership here), since both grow this center's headcount.
    if (req.tenantCenterId) {
      const capacityLimit = await getEffectiveCapacity(req.tenantCenterId, 'COACH_CAPACITY');
      const countResult = await query(
        `SELECT COUNT(*) FROM user_center_memberships WHERE center_id = $1 AND role IN ($2, $3)`,
        [req.tenantCenterId, UserRole.HEAD_COACH, UserRole.ASSISTANT_COACH]
      );
      const currentCount = parseInt(countResult.rows[0].count, 10);
      if (currentCount >= capacityLimit) {
        res.status(403).json({
          error: `Coach limit reached (${capacityLimit}). Upgrade your Coach Capacity plan in the Marketplace to add more coaches.`,
          code: 'CAPACITY_LIMIT_REACHED',
        });
        return;
      }
    }

    // If no password provided, generate a random one (coach sets it via email link)
    const actualPassword = (password && typeof password === 'string' && password.length > 0)
      ? password
      : crypto.randomBytes(16).toString('hex');

    // Check if username already exists
    const existingUser = await query(
      'SELECT id, name, username, role, email, profile_photo, specialization, senior_coach_id, phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary, created_at, last_active FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
      [username]
    );

    // The email already belongs to someone — a person can hold a coach role at more than
    // one center (e.g. a coach who also helps out at a second academy), so rather than
    // rejecting outright, grant their existing account a membership at this center instead
    // of creating a duplicate users row. Their shared profile (name, specialization, salary,
    // etc.) stays whatever it already was — this only adds access, it never overwrites it.
    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];

      if (!req.tenantCenterId) {
        res.status(400).json({ error: 'A user with this email already exists' });
        return;
      }

      const alreadyMember = await getMembership(existing.id, req.tenantCenterId);
      if (alreadyMember) {
        res.status(400).json({
          error: 'This user is already a coach at this center',
        });
        return;
      }

      await createMembership(existing.id, req.tenantCenterId, UserRole.ASSISTANT_COACH);

      res.status(201).json({
        id: existing.id,
        username: existing.username,
        role: UserRole.ASSISTANT_COACH,
        name: existing.name,
        email: existing.email,
        profilePhoto: existing.profile_photo,
        specialization: existing.specialization,
        centerId: req.tenantCenterId,
        seniorCoachId: existing.senior_coach_id || null,
        phone: existing.phone || null,
        dateOfBirth: existing.date_of_birth || null,
        address: existing.address || null,
        qualification: existing.qualification || null,
        experienceYears: existing.experience_years ?? null,
        bankDetails: existing.bank_details || null,
        monthlySalary: existing.monthly_salary != null ? parseFloat(existing.monthly_salary) : null,
        createdAt: existing.created_at,
        lastActive: existing.last_active,
        grantedExistingAccount: true,
      });
      return;
    }

    // Validate seniorCoachId if provided
    if (seniorCoachId !== undefined && seniorCoachId !== null) {
      if (!isValidUUID(seniorCoachId)) {
        res.status(400).json({
          error: 'Senior coach ID format is invalid',
        });
        return;
      }

      const seniorCoachResult = await query(
        `SELECT id FROM users WHERE id = $1 AND role IN ('HEAD_COACH', 'ASSISTANT_COACH') AND center_id = $2`,
        [seniorCoachId, req.tenantCenterId]
      );

      if (seniorCoachResult.rows.length === 0) {
        res.status(400).json({
          error: 'Invalid senior coach reference. The selected coach does not exist or is not available at this center.',
        });
        return;
      }
    }

    // Determine role based on seniorCoachId presence
    // Default to ASSISTANT_COACH when created by head coach
    const assignedRole = UserRole.ASSISTANT_COACH;

    // Hash password
    const passwordHash = await hashPassword(actualPassword);

    // Insert new coach
    const result = await query(
      `INSERT INTO users (username, password_hash, role, name, email, profile_photo, specialization, center_id, senior_coach_id, phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary, created_at, last_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, username, role, name, email, profile_photo, specialization, center_id, senior_coach_id, phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary, created_at, last_active`,
      [
        username,
        passwordHash,
        assignedRole,
        name,
        email || null,
        profilePhoto || null,
        specialization || null,
        req.tenantCenterId || null,
        seniorCoachId || null,
        phone || null,
        dateOfBirth || null,
        address || null,
        qualification || null,
        experienceYears ?? null,
        bankDetails || null,
        monthlySalary ?? null,
      ]
    );

    const coach = result.rows[0];

    // Without a membership row, login's non-ADMIN flow finds zero memberships and rejects
    // this coach with "User not associated with a center" forever — this must succeed for
    // the account to ever be usable, so it's awaited here rather than fired-and-forgotten.
    await createMembership(coach.id, req.tenantCenterId!, assignedRole);

    res.status(201).json({
      id: coach.id,
      username: coach.username,
      role: coach.role,
      name: coach.name,
      email: coach.email,
      profilePhoto: coach.profile_photo,
      specialization: coach.specialization,
      centerId: coach.center_id,
      seniorCoachId: coach.senior_coach_id || null,
      phone: coach.phone || null,
      dateOfBirth: coach.date_of_birth || null,
      address: coach.address || null,
      qualification: coach.qualification || null,
      experienceYears: coach.experience_years ?? null,
      bankDetails: coach.bank_details || null,
      monthlySalary: coach.monthly_salary != null ? parseFloat(coach.monthly_salary) : null,
      createdAt: coach.created_at,
      lastActive: coach.last_active,
    });

    // Fire-and-forget welcome email if coach has an email address
    if (email) {
      setImmediate(async () => {
        try {
          // Generate password reset token
          const rawToken = generateResetToken();
          const tokenHash = hashToken(rawToken);
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

          // Invalidate existing tokens for this user
          await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [coach.id]);

          // Store hashed token
          await query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [coach.id, tokenHash, expiresAt.toISOString()]
          );

          // Generate URLs
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;
          const loginUrl = `${frontendUrl}/login`;

          // Look up center name
          let centerName = 'your center';
          if (req.tenantCenterId) {
            const centerResult = await query(
              'SELECT name FROM centers WHERE id = $1',
              [req.tenantCenterId]
            );
            if (centerResult.rows.length > 0) {
              centerName = centerResult.rows[0].name;
            }
          }

          sendCoachWelcomeEmail({
            coachEmail: email,
            coachName: name,
            coachUsername: username,
            centerName,
            resetLink,
            loginUrl,
            centerId: req.tenantCenterId || undefined,
          });
        } catch (emailError) {
          console.error(`[CreateCoach] Failed to send welcome email for coach ${coach.id}:`, emailError);
        }
      });
    }
  } catch (error: unknown) {
    console.error('Create coach error:', error);
    
    // Handle unique constraint violations
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('unique') || errMsg.includes('duplicate') || errMsg.includes('23505')) {
      res.status(400).json({
        error: 'A user with this email already exists',
      });
      return;
    }
    
    res.status(500).json({
      error: 'An error occurred while creating the coach account',
    });
  }
};

/**
 * PATCH /api/coaches/:id
 * Update coach profile information (Head Coach only)
 */
export const updateCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const allowedFields: Record<string, string> = {
      name: 'name',
      email: 'email',
      specialization: 'specialization',
      profilePhoto: 'profile_photo',
      phone: 'phone',
      dateOfBirth: 'date_of_birth',
      address: 'address',
      qualification: 'qualification',
      experienceYears: 'experience_years',
      bankDetails: 'bank_details',
      monthlySalary: 'monthly_salary',
    };

    // Validate monthlySalary if provided and not null
    if (req.body.monthlySalary !== undefined && req.body.monthlySalary !== null) {
      if (typeof req.body.monthlySalary !== 'number' || req.body.monthlySalary <= 0) {
        res.status(400).json({ error: 'monthly_salary must be a positive number or null' });
        return;
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const [bodyKey, dbColumn] of Object.entries(allowedFields)) {
      if (req.body[bodyKey] !== undefined) {
        updates.push(`${dbColumn} = $${paramIndex}`);
        // Allow null for nullable fields; for string fields use null if empty
        const value = req.body[bodyKey];
        params.push(value ?? null);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Verify the target has a coach membership at this center — not users.center_id, which
    // only reflects one "home" center for someone who coaches at more than one.
    if (req.tenantCenterId) {
      const membership = await getMembership(String(id), req.tenantCenterId);
      if (!membership || (membership.role !== UserRole.HEAD_COACH && membership.role !== UserRole.ASSISTANT_COACH)) {
        res.status(404).json({ error: 'Coach not found' });
        return;
      }
    }

    params.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, username, role, name, email, profile_photo, specialization, senior_coach_id, phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary, created_at, last_active`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    const coach = result.rows[0];
    res.status(200).json({
      id: coach.id,
      username: coach.username,
      role: coach.role,
      name: coach.name,
      email: coach.email,
      profilePhoto: coach.profile_photo,
      specialization: coach.specialization,
      seniorCoachId: coach.senior_coach_id || null,
      phone: coach.phone || null,
      dateOfBirth: coach.date_of_birth || null,
      address: coach.address || null,
      qualification: coach.qualification || null,
      experienceYears: coach.experience_years ?? null,
      bankDetails: coach.bank_details || null,
      monthlySalary: coach.monthly_salary != null ? parseFloat(coach.monthly_salary) : null,
      createdAt: coach.created_at,
      lastActive: coach.last_active,
    });
  } catch (error) {
    console.error('Update coach error:', error);
    res.status(500).json({
      error: 'An error occurred while updating the coach',
    });
  }
};

/**
 * GET /api/coaches/:id
 * Get a single coach's full profile by ID.
 * HEAD_COACH can view any coach in their center.
 * ASSISTANT_COACH can view only their own profile.
 */
export const getCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // ASSISTANT_COACH can only access their own profile
    if (req.user?.role === UserRole.ASSISTANT_COACH) {
      if (req.user.id !== id) {
        res.status(403).json({ error: 'You do not have permission to perform this action' });
        return;
      }
    }

    // Query coach by ID, scoped to a coach membership at the requesting user's center — not
    // users.center_id, which only reflects one "home" center for someone who coaches at more
    // than one.
    const result = await query(
      `SELECT u.id, u.username, ucm.role, u.name, u.email, u.profile_photo, u.specialization, u.senior_coach_id,
              u.phone, u.date_of_birth, u.address, u.qualification, u.experience_years, u.bank_details, u.monthly_salary,
              u.created_at, u.last_active
       FROM users u
       JOIN user_center_memberships ucm ON ucm.user_id = u.id
       WHERE u.id = $1 AND ucm.center_id = $2 AND ucm.role IN ('HEAD_COACH', 'ASSISTANT_COACH')`,
      [id, req.tenantCenterId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    const coach = result.rows[0];
    res.status(200).json({
      id: coach.id,
      username: coach.username,
      role: coach.role,
      name: coach.name,
      email: coach.email,
      profilePhoto: coach.profile_photo,
      specialization: coach.specialization,
      seniorCoachId: coach.senior_coach_id || null,
      phone: coach.phone || null,
      dateOfBirth: coach.date_of_birth || null,
      address: coach.address || null,
      qualification: coach.qualification || null,
      experienceYears: coach.experience_years ?? null,
      bankDetails: coach.bank_details || null,
      monthlySalary: coach.monthly_salary != null ? parseFloat(coach.monthly_salary) : null,
      createdAt: coach.created_at,
      lastActive: coach.last_active,
    });
  } catch (error) {
    console.error('Get coach error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching the coach profile',
    });
  }
};

/**
 * GET /api/coaches
 * List all assistant coaches with their assignment counts (Head Coach only)
 */
export const listCoaches = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    // A coach "belongs" to this center if they hold a coach membership here — not merely if
    // users.center_id (their legacy single "home" center) happens to match, since a person
    // can coach at more than one center via a second user_center_memberships row.
    const conditions: string[] = ["ucm.role IN ('HEAD_COACH', 'ASSISTANT_COACH')"];
    const params: any[] = [];
    let paramIndex = 1;

    if (req.tenantCenterId) {
      conditions.push(`ucm.center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch all coaches (HEAD_COACH and ASSISTANT_COACH) with assignment counts
    const result = await query(
      `SELECT
        u.id,
        u.username,
        ucm.role,
        u.name,
        u.email,
        u.profile_photo,
        u.specialization,
        u.can_access_fees,
        u.created_at,
        u.last_active,
        COUNT(DISTINCT s.id) as assigned_student_count,
        COUNT(DISTINCT s.batch_id) as assigned_batch_count
       FROM users u
       JOIN user_center_memberships ucm ON ucm.user_id = u.id
       LEFT JOIN students s ON s.assigned_coach_id = u.id
       ${whereClause}
       GROUP BY u.id, u.username, ucm.role, u.name, u.email, u.profile_photo, u.specialization, u.can_access_fees, u.created_at, u.last_active
       ORDER BY u.name ASC`,
      params
    );

    const coaches = result.rows.map((coach: any) => ({
      id: coach.id,
      username: coach.username,
      role: coach.role,
      name: coach.name,
      email: coach.email,
      profilePhoto: coach.profile_photo,
      specialization: coach.specialization,
      canAccessFees: coach.can_access_fees,
      createdAt: coach.created_at,
      lastActive: coach.last_active,
      assignedStudentCount: parseInt(coach.assigned_student_count, 10),
      assignedBatchCount: parseInt(coach.assigned_batch_count, 10),
    }));

    res.status(200).json(coaches);
  } catch (error) {
    console.error('List coaches error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching coaches',
    });
  }
};

/**
 * PATCH /api/coaches/:id/fee-access
 * Toggle fee access for a coach (HEAD_COACH only)
 * Body: { canAccessFees: boolean }
 */
export const toggleFeeAccess = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: targetCoachId } = req.params;
    const { canAccessFees } = req.body;

    // Validate body is boolean
    if (typeof canAccessFees !== 'boolean') {
      res.status(400).json({ error: 'canAccessFees must be a boolean' });
      return;
    }

    // Verify target user exists
    const targetResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [targetCoachId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    // Verify target has a coach membership at this center — not users.center_id, which only
    // reflects one "home" center for someone who coaches at more than one.
    if (!req.tenantCenterId) {
      res.status(403).json({ error: 'Cannot modify coaches outside your center' });
      return;
    }
    const membership = await getMembership(String(targetCoachId), req.tenantCenterId);
    if (!membership) {
      res.status(403).json({ error: 'Cannot modify coaches outside your center' });
      return;
    }
    if (membership.role !== UserRole.ASSISTANT_COACH && membership.role !== UserRole.HEAD_COACH) {
      res.status(400).json({ error: 'Fee access can only be toggled for coaches' });
      return;
    }

    // Update the can_access_fees flag
    await query(
      'UPDATE users SET can_access_fees = $1 WHERE id = $2',
      [canAccessFees, targetCoachId]
    );

    res.status(200).json({
      id: targetCoachId,
      canAccessFees,
    });
  } catch (error) {
    console.error('Toggle fee access error:', error);
    res.status(500).json({
      error: 'An error occurred while toggling fee access',
    });
  }
};

/**
 * DELETE /api/coaches/:id
 * Delete an assistant coach (Head Coach only).
 *
 * The shared `users` row is never hard-deleted: it may hold memberships at
 * other centers (see createCoach's "grant existing account" path), and
 * several tables (coach_salary_profile, courses, batch_time_templates, etc.)
 * hold non-nullable FKs to users.id that a hard delete would violate for any
 * coach with real activity. Instead this unassigns the coach from batches
 * and students at this center — matching the frontend's confirmation dialog
 * — then removes their membership at this center only. With zero
 * memberships left, login already rejects them here (see createCoach), so
 * this is effectively "deleted" from this center's point of view.
 */
export const deleteCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: coachId } = req.params;

    if (!req.tenantCenterId) {
      res.status(403).json({ error: 'Cannot delete coaches outside your center' });
      return;
    }

    const membership = await getMembership(String(coachId), req.tenantCenterId);
    if (!membership || membership.role !== UserRole.ASSISTANT_COACH) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    // Unassign this coach from all batches and students at this center
    await query(
      'UPDATE batches SET assigned_coach_id = NULL WHERE assigned_coach_id = $1 AND center_id = $2',
      [coachId, req.tenantCenterId]
    );
    await query(
      'UPDATE students SET assigned_coach_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assigned_coach_id = $1 AND center_id = $2',
      [coachId, req.tenantCenterId]
    );

    // Also clear the multi-coach-per-batch assignment table (see batchCoachAssignments'
    // removeCoach, which performs the same cleanup when a coach leaves a single batch).
    await query(
      `DELETE FROM batch_coach_assignments
       WHERE coach_id = $1 AND batch_id IN (SELECT id FROM batches WHERE center_id = $2)`,
      [coachId, req.tenantCenterId]
    );

    await removeMembership(String(coachId), req.tenantCenterId, UserRole.ASSISTANT_COACH);

    res.status(200).json({
      success: true,
      message: 'Coach deleted successfully',
    });
  } catch (error) {
    console.error('Delete coach error:', error);
    res.status(500).json({
      error: 'An error occurred while deleting the coach',
    });
  }
};

/**
 * PATCH /api/coaches/:id/assign
 * Assign or unassign students or batch to a coach (Head Coach only)
 */
export const assignCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: coachId } = req.params;
    const { studentIds, batchId, action } = req.body;

    // Validate action
    if (!action || !['ASSIGN', 'UNASSIGN'].includes(action)) {
      res.status(400).json({
        error: 'Action must be either ASSIGN or UNASSIGN',
      });
      return;
    }

    // Validate that at least one of studentIds or batchId is provided
    if (!studentIds && !batchId) {
      res.status(400).json({
        error: 'Either studentIds or batchId must be provided',
      });
      return;
    }

    // Verify coach exists and has an assistant-coach membership at this center — not
    // users.center_id, which only reflects one "home" center for someone who coaches at
    // more than one. Falls back to the legacy users.role when unscoped (ADMIN).
    const coachResult = await query('SELECT id, role FROM users WHERE id = $1', [coachId]);

    if (coachResult.rows.length === 0) {
      res.status(404).json({
        error: 'Coach not found',
      });
      return;
    }

    let coachRoleAtCenter: string = coachResult.rows[0].role;
    if (req.tenantCenterId) {
      const membership = await getMembership(String(coachId), req.tenantCenterId);
      if (!membership) {
        res.status(404).json({
          error: 'Coach not found',
        });
        return;
      }
      coachRoleAtCenter = membership.role;
    }

    if (coachRoleAtCenter !== UserRole.ASSISTANT_COACH) {
      res.status(400).json({
        error: 'Can only assign assistant coaches',
      });
      return;
    }

    const newCoachId = action === 'ASSIGN' ? coachId : null;

    // Handle batch assignment
    if (batchId) {
      // Update all students in the batch (with tenant scoping)
      if (req.tenantCenterId) {
        await query(
          'UPDATE students SET assigned_coach_id = $1, updated_at = CURRENT_TIMESTAMP WHERE batch_id = $2 AND center_id = $3',
          [newCoachId, batchId, req.tenantCenterId]
        );
        await query(
          'UPDATE batches SET assigned_coach_id = $1 WHERE id = $2 AND center_id = $3',
          [newCoachId, batchId, req.tenantCenterId]
        );
      } else {
        await query(
          'UPDATE students SET assigned_coach_id = $1, updated_at = CURRENT_TIMESTAMP WHERE batch_id = $2',
          [newCoachId, batchId]
        );
        await query(
          'UPDATE batches SET assigned_coach_id = $1 WHERE id = $2',
          [newCoachId, batchId]
        );
      }
    }

    // Handle individual student assignments
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      const placeholders = studentIds.map((_: any, index: number) => `$${index + 2}`).join(', ');
      if (req.tenantCenterId) {
        await query(
          `UPDATE students SET assigned_coach_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND center_id = $${studentIds.length + 2}`,
          [newCoachId, ...studentIds, req.tenantCenterId]
        );
      } else {
        await query(
          `UPDATE students SET assigned_coach_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
          [newCoachId, ...studentIds]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully ${action === 'ASSIGN' ? 'assigned' : 'unassigned'} coach`,
    });
  } catch (error) {
    console.error('Assign coach error:', error);
    res.status(500).json({
      error: 'An error occurred while assigning coach',
    });
  }
};
