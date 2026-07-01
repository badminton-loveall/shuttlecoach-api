import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { TrainingLog, UserRole } from '../types';

/**
 * POST /api/training-logs
 * Create a new training log entry
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const createTrainingLog = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      studentId,
      weekNumber,
      cycleKey,
      sessionNotes,
      isCompleted = false,
    } = req.body;

    // Validate required fields
    if (!studentId || !weekNumber || !cycleKey) {
      res.status(400).json({
        error: 'Missing required fields: studentId, weekNumber, cycleKey',
      });
      return;
    }

    // Validate week number range
    if (weekNumber < 1 || weekNumber > 8) {
      res.status(400).json({
        error: 'weekNumber must be between 1 and 8',
      });
      return;
    }

    // Authorization check for assistant coaches
    if (req.user.role === UserRole.ASSISTANT_COACH) {
      // Verify the student is assigned to this coach
      const studentCheck = await query(
        `SELECT id FROM students WHERE id = $1 AND assigned_coach_id = $2`,
        [studentId, req.user.id]
      );
      if (studentCheck.rows.length === 0) {
        res.status(403).json({
          error: 'You do not have permission to log training for this student',
        });
        return;
      }
    }

    // Insert training log
    const result = await query(
      `INSERT INTO training_logs (
        student_id, week_number, cycle_key, session_notes, is_completed, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, student_id, week_number, cycle_key, session_notes, 
        is_completed, recorded_by, recorded_at`,
      [
        studentId,
        weekNumber,
        cycleKey,
        sessionNotes || null,
        isCompleted,
        req.user.username || req.user.id,
      ]
    );

    const trainingLog = mapDatabaseRowToTrainingLog(result.rows[0]);
    res.status(201).json(trainingLog);
  } catch (error: any) {
    console.error('Create training log error:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      res.status(409).json({
        error: 'Training log already exists for this student, cycle, and week',
      });
      return;
    }

    res.status(500).json({
      error: 'An error occurred while creating training log',
    });
  }
};

/**
 * GET /api/training-logs
 * Query training logs by filters
 * Query params: ?studentId=<id>&cycleKey=<key>
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const getTrainingLogs = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId, cycleKey } = req.query;

    // Build WHERE clause based on filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (studentId) {
      conditions.push(`student_id = $${paramIndex}`);
      params.push(studentId);
      paramIndex++;

      // Authorization check for assistant coaches
      if (req.user.role === UserRole.ASSISTANT_COACH) {
        // Verify the student is assigned to this coach
        const studentCheck = await query(
          `SELECT id FROM students WHERE id = $1 AND assigned_coach_id = $2`,
          [studentId, req.user.id]
        );
        if (studentCheck.rows.length === 0) {
          res.status(403).json({
            error: 'You do not have permission to access logs for this student',
          });
          return;
        }
      }
    } else if (req.user.role === UserRole.ASSISTANT_COACH) {
      // Restrict to only assigned students
      conditions.push(
        `student_id IN (SELECT id FROM students WHERE assigned_coach_id = $${paramIndex})`
      );
      params.push(req.user.id);
      paramIndex++;
    }

    if (cycleKey) {
      conditions.push(`cycle_key = $${paramIndex}`);
      params.push(cycleKey);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch training logs
    const result = await query(
      `SELECT 
        id, student_id, week_number, cycle_key, session_notes, 
        is_completed, recorded_by, recorded_at
      FROM training_logs
      ${whereClause}
      ORDER BY recorded_at DESC`,
      params
    );

    const logs = result.rows.map(mapDatabaseRowToTrainingLog);
    res.status(200).json(logs);
  } catch (error) {
    console.error('Get training logs error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching training logs',
    });
  }
};

/**
 * PATCH /api/training-logs/:id
 * Update an existing training log
 * Requires: HEAD_COACH or ASSISTANT_COACH (must be assigned to student)
 */
export const updateTrainingLog = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Fetch existing log
    const existingResult = await query(
      `SELECT 
        id, student_id, week_number, cycle_key, session_notes, 
        is_completed, recorded_by, recorded_at
      FROM training_logs
      WHERE id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Training log not found' });
      return;
    }

    const existingLog = existingResult.rows[0];

    // Authorization check for assistant coaches
    if (req.user.role === UserRole.ASSISTANT_COACH) {
      // Verify the student is assigned to this coach
      const studentCheck = await query(
        `SELECT id FROM students WHERE id = $1 AND assigned_coach_id = $2`,
        [existingLog.student_id, req.user.id]
      );
      if (studentCheck.rows.length === 0) {
        res.status(403).json({
          error: 'You do not have permission to edit this log',
        });
        return;
      }
    }

    // Build UPDATE query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const allowedFields = {
      sessionNotes: 'session_notes',
      isCompleted: 'is_completed',
    };

    Object.entries(allowedFields).forEach(([camelKey, snakeKey]) => {
      if (req.body[camelKey] !== undefined) {
        updates.push(`${snakeKey} = $${paramIndex}`);
        params.push(req.body[camelKey]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Add log ID as last parameter
    params.push(id);

    // Execute update
    const result = await query(
      `UPDATE training_logs
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, student_id, week_number, cycle_key, session_notes, 
        is_completed, recorded_by, recorded_at`,
      params
    );

    const log = mapDatabaseRowToTrainingLog(result.rows[0]);
    res.status(200).json(log);
  } catch (error) {
    console.error('Update training log error:', error);
    res.status(500).json({
      error: 'An error occurred while updating training log',
    });
  }
};

/**
 * Helper function to map database row to TrainingLog type
 */
function mapDatabaseRowToTrainingLog(row: any): TrainingLog {
  return {
    id: row.id,
    studentId: row.student_id,
    weekNumber: row.week_number,
    cycleKey: row.cycle_key,
    sessionNotes: row.session_notes,
    isCompleted: row.is_completed,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
  };
}
