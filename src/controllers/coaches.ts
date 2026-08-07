import { Response } from 'express';
import { query } from '../config/database';
import { hashPassword } from '../utils/auth';
import { UserRole } from '../types';
import { TenantRequest } from '../middleware/tenantScope';

/**
 * POST /api/coaches
 * Create a new assistant coach account (Head Coach only)
 */
export const createCoach = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, username, password, specialization, profilePhoto, email } = req.body;

    // Validate required fields
    if (!name || !username || !password) {
      res.status(400).json({
        error: 'Name, username, and password are required',
      });
      return;
    }

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

    // Hash password
    const passwordHash = await hashPassword(password);

    // Insert new assistant coach with center_id
    const result = await query(
      `INSERT INTO users (username, password_hash, role, name, email, profile_photo, specialization, center_id, created_at, last_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, username, role, name, email, profile_photo, specialization, created_at, last_active`,
      [
        username,
        passwordHash,
        UserRole.ASSISTANT_COACH,
        name,
        email || null,
        profilePhoto || null,
        specialization || null,
        req.tenantCenterId || null,
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
      createdAt: coach.created_at,
      lastActive: coach.last_active,
    });
  } catch (error) {
    console.error('Create coach error:', error);
    res.status(500).json({
      error: 'An error occurred while creating the coach account',
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
    const conditions: string[] = ['u.role = $1'];
    const params: any[] = [UserRole.ASSISTANT_COACH];
    let paramIndex = 2;

    if (req.tenantCenterId) {
      conditions.push(`u.center_id = $${paramIndex}`);
      params.push(req.tenantCenterId);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch all assistant coaches with assignment counts
    const result = await query(
      `SELECT 
        u.id,
        u.username,
        u.role,
        u.name,
        u.email,
        u.profile_photo,
        u.specialization,
        u.created_at,
        u.last_active,
        COUNT(DISTINCT s.id) as assigned_student_count,
        COUNT(DISTINCT s.batch_id) as assigned_batch_count
       FROM users u
       LEFT JOIN students s ON s.assigned_coach_id = u.id
       ${whereClause}
       GROUP BY u.id, u.username, u.role, u.name, u.email, u.profile_photo, u.specialization, u.created_at, u.last_active
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
