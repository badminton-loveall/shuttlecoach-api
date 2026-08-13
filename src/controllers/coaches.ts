import { Response } from 'express';
import { query } from '../config/database';
import { hashPassword } from '../utils/auth';
import { generateResetToken, hashToken } from '../utils/tokenGenerator';
import { sendCoachWelcomeEmail } from '../services/welcomeEmailService';
import { UserRole } from '../types';
import { TenantRequest } from '../middleware/tenantScope';

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

    // If no password provided, generate a random one (coach sets it via email link)
    const actualPassword = password || generateResetToken().slice(0, 16);

    // Check if username already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      res.status(400).json({
        error: 'Username already exists',
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
    const assignedRole = seniorCoachId ? UserRole.ASSISTANT_COACH : UserRole.HEAD_COACH;

    // Hash password
    const passwordHash = await hashPassword(actualPassword);

    // Insert new coach with center_id, senior_coach_id, and extended profile fields
    const result = await query(
      `INSERT INTO users (username, password_hash, role, name, email, profile_photo, specialization, center_id, senior_coach_id, phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary, created_at, last_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, username, role, name, email, profile_photo, specialization, senior_coach_id, phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary, created_at, last_active`,
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

    res.status(201).json({
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
  } catch (error) {
    console.error('Create coach error:', error);
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

    params.push(id);

    // Build WHERE clause with tenant scoping
    const whereConditions = [`id = $${paramIndex}`];
    paramIndex++;

    if (req.tenantCenterId) {
      whereConditions.push(`center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    const result = await query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE ${whereConditions.join(' AND ')}
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

    // Query coach by ID scoped to the requesting user's center
    const result = await query(
      `SELECT id, username, role, name, email, profile_photo, specialization, senior_coach_id,
              phone, date_of_birth, address, qualification, experience_years, bank_details, monthly_salary,
              created_at, last_active
       FROM users
       WHERE id = $1 AND center_id = $2 AND role IN ('HEAD_COACH', 'ASSISTANT_COACH')`,
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
    // Build WHERE clause with tenant scoping
    const conditions: string[] = ["u.role IN ('HEAD_COACH', 'ASSISTANT_COACH')"];
    const params: any[] = [];
    let paramIndex = 1;

    if (req.tenantCenterId) {
      conditions.push(`u.center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch all coaches (HEAD_COACH and ASSISTANT_COACH) with assignment counts
    const result = await query(
      `SELECT 
        u.id,
        u.username,
        u.role,
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
       LEFT JOIN students s ON s.assigned_coach_id = u.id
       ${whereClause}
       GROUP BY u.id, u.username, u.role, u.name, u.email, u.profile_photo, u.specialization, u.can_access_fees, u.created_at, u.last_active
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
      'SELECT id, role, center_id FROM users WHERE id = $1',
      [targetCoachId]
    );

    if (targetResult.rows.length === 0) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    const target = targetResult.rows[0];

    // Verify target is in the same center
    if (target.center_id !== req.tenantCenterId) {
      res.status(403).json({ error: 'Cannot modify coaches outside your center' });
      return;
    }

    // Verify target is HEAD_COACH or ASSISTANT_COACH
    if (target.role !== UserRole.ASSISTANT_COACH && target.role !== UserRole.HEAD_COACH) {
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

    // Verify coach exists and is an assistant coach (with tenant scoping)
    const coachConditions = ['id = $1'];
    const coachParams: any[] = [coachId];

    if (req.tenantCenterId) {
      coachConditions.push('center_id = $2');
      coachParams.push(req.tenantCenterId);
    }

    const coachResult = await query(
      `SELECT id, role FROM users WHERE ${coachConditions.join(' AND ')}`,
      coachParams
    );

    if (coachResult.rows.length === 0) {
      res.status(404).json({
        error: 'Coach not found',
      });
      return;
    }

    if (coachResult.rows[0].role !== UserRole.ASSISTANT_COACH) {
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
