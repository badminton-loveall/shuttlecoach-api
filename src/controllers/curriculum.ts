import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { CurriculumPlan, WeekPlan, UserRole } from '../types';

/**
 * POST /api/curriculum
 * Create a new curriculum plan (batch or individual)
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const createCurriculumPlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      cycleKey,
      batchId,
      studentId,
      sourceBatchPlanId,
      weeks,
      isArchived = false,
    } = req.body;

    // Validate required fields
    if (!cycleKey || !weeks) {
      res.status(400).json({
        error: 'Missing required fields: cycleKey, weeks',
      });
      return;
    }

    // Validate that either batchId OR studentId is provided, not both
    if ((batchId && studentId) || (!batchId && !studentId)) {
      res.status(400).json({
        error: 'Must provide either batchId OR studentId, not both',
      });
      return;
    }

    // Validate weeks array structure
    if (!Array.isArray(weeks) || weeks.length !== 8) {
      res.status(400).json({
        error: 'weeks must be an array of 8 week plans',
      });
      return;
    }

    // Validate each week has required fields
    const isValidWeeks = weeks.every(
      (week: WeekPlan) =>
        week.weekNumber >= 1 &&
        week.weekNumber <= 8 &&
        week.focusArea &&
        week.objective &&
        Array.isArray(week.drills)
    );

    if (!isValidWeeks) {
      res.status(400).json({
        error: 'Each week must have weekNumber (1-8), focusArea, objective, and drills array',
      });
      return;
    }

    // Insert curriculum plan
    const result = await query(
      `INSERT INTO curriculum_plans (
        cycle_key, batch_id, student_id, source_batch_plan_id, weeks, is_archived
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, cycle_key, batch_id, student_id, source_batch_plan_id, 
        weeks, is_archived, created_at, updated_at`,
      [
        cycleKey,
        batchId || null,
        studentId || null,
        sourceBatchPlanId || null,
        JSON.stringify(weeks),
        isArchived,
      ]
    );

    const curriculumPlan = mapDatabaseRowToCurriculumPlan(result.rows[0]);
    res.status(201).json(curriculumPlan);
  } catch (error) {
    console.error('Create curriculum plan error:', error);
    res.status(500).json({
      error: 'An error occurred while creating curriculum plan',
    });
  }
};

/**
 * POST /api/curriculum/:id/clone
 * Clone a batch curriculum plan to all students in that batch
 * Requires: HEAD_COACH role
 */
export const cloneBatchPlanToStudents = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Fetch the batch plan
    const planResult = await query(
      `SELECT 
        id, cycle_key, batch_id, weeks, is_archived
      FROM curriculum_plans
      WHERE id = $1 AND batch_id IS NOT NULL`,
      [id]
    );

    if (planResult.rows.length === 0) {
      res.status(404).json({ error: 'Batch curriculum plan not found' });
      return;
    }

    const batchPlan = planResult.rows[0];

    // Fetch all students in the batch
    const studentsResult = await query(
      `SELECT id FROM students WHERE batch_id = $1`,
      [batchPlan.batch_id]
    );

    if (studentsResult.rows.length === 0) {
      res.status(400).json({ error: 'No students found in this batch' });
      return;
    }

    // Create individual plans for each student
    const insertPromises = studentsResult.rows.map((student) => {
      // If weeks is already a string, use it directly; otherwise stringify
      const weeksValue = typeof batchPlan.weeks === 'string' 
        ? batchPlan.weeks 
        : JSON.stringify(batchPlan.weeks);
      
      return query(
        `INSERT INTO curriculum_plans (
          cycle_key, student_id, source_batch_plan_id, weeks, is_archived
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING 
          id, cycle_key, batch_id, student_id, source_batch_plan_id, 
          weeks, is_archived, created_at, updated_at`,
        [
          batchPlan.cycle_key,
          student.id,
          batchPlan.id,
          weeksValue,
          batchPlan.is_archived,
        ]
      );
    });

    const results = await Promise.all(insertPromises);
    const createdPlans = results.map((result) =>
      mapDatabaseRowToCurriculumPlan(result.rows[0])
    );

    res.status(201).json({
      message: `Successfully cloned batch plan to ${createdPlans.length} students`,
      createdPlans,
    });
  } catch (error) {
    console.error('Clone batch plan error:', error);
    res.status(500).json({
      error: 'An error occurred while cloning batch plan',
    });
  }
};

/**
 * GET /api/curriculum
 * Query curriculum plans by filters
 * Query params: ?studentId=<id>&cycleKey=<key>&batchId=<id>
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const getCurriculumPlans = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId, cycleKey, batchId } = req.query;

    // Build WHERE clause based on filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (studentId) {
      conditions.push(`student_id = $${paramIndex}`);
      params.push(studentId);
      paramIndex++;
    }

    if (batchId) {
      conditions.push(`batch_id = $${paramIndex}`);
      params.push(batchId);
      paramIndex++;
    }

    if (cycleKey) {
      conditions.push(`cycle_key = $${paramIndex}`);
      params.push(cycleKey);
      paramIndex++;
    }

    // Assistant coaches can only see plans for assigned students
    if (req.user.role === UserRole.ASSISTANT_COACH) {
      if (studentId) {
        // Verify the student is assigned to this coach
        const studentCheck = await query(
          `SELECT id FROM students WHERE id = $1 AND assigned_coach_id = $2`,
          [studentId, req.user.id]
        );
        if (studentCheck.rows.length === 0) {
          res.status(403).json({
            error: 'You do not have permission to access this student',
          });
          return;
        }
      } else {
        // Restrict to only assigned students
        conditions.push(
          `student_id IN (SELECT id FROM students WHERE assigned_coach_id = $${paramIndex})`
        );
        params.push(req.user.id);
        paramIndex++;
      }
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch curriculum plans
    const result = await query(
      `SELECT 
        id, cycle_key, batch_id, student_id, source_batch_plan_id, 
        weeks, is_archived, created_at, updated_at
      FROM curriculum_plans
      ${whereClause}
      ORDER BY created_at DESC`,
      params
    );

    const plans = result.rows.map(mapDatabaseRowToCurriculumPlan);
    res.status(200).json(plans);
  } catch (error) {
    console.error('Get curriculum plans error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching curriculum plans',
    });
  }
};

/**
 * PATCH /api/curriculum/:id
 * Update an individual curriculum plan
 * Requires: HEAD_COACH or assigned ASSISTANT_COACH
 */
export const updateCurriculumPlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Fetch existing plan
    const existingResult = await query(
      `SELECT 
        id, cycle_key, batch_id, student_id, source_batch_plan_id, 
        weeks, is_archived, created_at, updated_at
      FROM curriculum_plans
      WHERE id = $1`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Curriculum plan not found' });
      return;
    }

    const existingPlan = existingResult.rows[0];

    // Prevent editing archived plans
    if (existingPlan.is_archived) {
      res.status(403).json({
        error: 'Cannot edit archived curriculum plans',
      });
      return;
    }

    // Authorization check for assistant coaches
    if (req.user.role === UserRole.ASSISTANT_COACH && existingPlan.student_id) {
      // Verify the student is assigned to this coach
      const studentCheck = await query(
        `SELECT id FROM students WHERE id = $1 AND assigned_coach_id = $2`,
        [existingPlan.student_id, req.user.id]
      );
      if (studentCheck.rows.length === 0) {
        res.status(403).json({
          error: 'You do not have permission to edit this plan',
        });
        return;
      }
    }

    // Build UPDATE query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    const allowedFields = {
      cycleKey: 'cycle_key',
      weeks: 'weeks',
      isArchived: 'is_archived',
    };

    Object.entries(allowedFields).forEach(([camelKey, snakeKey]) => {
      if (req.body[camelKey] !== undefined) {
        updates.push(`${snakeKey} = $${paramIndex}`);
        // Stringify weeks if it's an object/array
        if (camelKey === 'weeks') {
          params.push(JSON.stringify(req.body[camelKey]));
        } else {
          params.push(req.body[camelKey]);
        }
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Add plan ID as last parameter
    params.push(id);

    // Execute update
    const result = await query(
      `UPDATE curriculum_plans
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, cycle_key, batch_id, student_id, source_batch_plan_id, 
        weeks, is_archived, created_at, updated_at`,
      params
    );

    const plan = mapDatabaseRowToCurriculumPlan(result.rows[0]);
    res.status(200).json(plan);
  } catch (error) {
    console.error('Update curriculum plan error:', error);
    res.status(500).json({
      error: 'An error occurred while updating curriculum plan',
    });
  }
};

/**
 * Helper function to map database row to CurriculumPlan type
 */
function mapDatabaseRowToCurriculumPlan(row: any): CurriculumPlan {
  return {
    id: row.id,
    cycleKey: row.cycle_key,
    batchId: row.batch_id,
    studentId: row.student_id,
    sourceBatchPlanId: row.source_batch_plan_id,
    weeks: typeof row.weeks === 'string' ? JSON.parse(row.weeks) : row.weeks,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
