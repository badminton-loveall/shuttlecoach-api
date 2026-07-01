import { Response } from 'express';
import { query } from '../config/database';
import { hashPassword } from '../utils/auth';
import { UserRole } from '../types';
import { AuthRequest } from '../middleware/auth';

/**
 * POST /api/coaches
 * Create a new assistant coach account (Head Coach only)
 */
export const createCoach = async (
  req: AuthRequest,
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

    // Insert new assistant coach
    const result = await query(
      `INSERT INTO users (username, password_hash, role, name, email, profile_photo, specialization, created_at, last_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, username, role, name, email, profile_photo, specialization, created_at, last_active`,
      [
        username,
        passwordHash,
        UserRole.ASSISTANT_COACH,
        name,
        email || null,
        profilePhoto || null,
        specialization || null,
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
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
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
       WHERE u.role = $1
       GROUP BY u.id, u.username, u.role, u.name, u.email, u.profile_photo, u.specialization, u.created_at, u.last_active
       ORDER BY u.name ASC`,
      [UserRole.ASSISTANT_COACH]
    );

    const coaches = result.rows.map((coach) => ({
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
  req: AuthRequest,
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

    // Verify coach exists and is an assistant coach
    const coachResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [coachId]
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
      // Update all students in the batch
      await query(
        'UPDATE students SET assigned_coach_id = $1, updated_at = CURRENT_TIMESTAMP WHERE batch_id = $2',
        [newCoachId, batchId]
      );

      // Update batch assignment
      await query(
        'UPDATE batches SET assigned_coach_id = $1 WHERE id = $2',
        [newCoachId, batchId]
      );
    }

    // Handle individual student assignments
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      const placeholders = studentIds.map((_, index) => `$${index + 2}`).join(', ');
      await query(
        `UPDATE students SET assigned_coach_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
        [newCoachId, ...studentIds]
      );
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
