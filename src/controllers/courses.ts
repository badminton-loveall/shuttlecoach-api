import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';

/**
 * POST /api/courses
 * Create a new course template
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const createCourse = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, weeks } = req.body;
    const coachId = req.user!.id;
    const centerId = req.tenantCenterId || null;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Course name is required' });
      return;
    }

    if (name.trim().length > 200) {
      res.status(400).json({ error: 'Course name must not exceed 200 characters' });
      return;
    }

    // Validate weeks
    if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 52) {
      res.status(400).json({ error: 'Course must have between 1 and 52 weeks' });
      return;
    }

    // Validate each week structure
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      if (!week.focusArea || !week.objective || !Array.isArray(week.drills)) {
        res.status(400).json({
          error: `Week ${i + 1} must have focusArea, objective, and drills array`,
        });
        return;
      }
    }

    // Re-number weeks sequentially starting from 1
    const numberedWeeks = weeks.map((week: any, index: number) => ({
      ...week,
      weekNumber: index + 1,
    }));

    const result = await query(
      `INSERT INTO courses (name, coach_id, weeks, center_id)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING id, name, coach_id, weeks, center_id, created_at, updated_at`,
      [name.trim(), coachId, JSON.stringify(numberedWeeks), centerId]
    );

    const course = mapCourseRow(result.rows[0]);
    res.status(201).json(course);
  } catch (error: any) {
    // Handle unique constraint violation (duplicate name per coach)
    if (error.code === '23505' && error.constraint === 'unique_course_name_per_coach') {
      res.status(409).json({ error: 'A course with this name already exists' });
      return;
    }
    console.error('Create course error:', error);
    res.status(500).json({ error: 'An error occurred while creating course' });
  }
};

/**
 * GET /api/courses
 * List all courses for the authenticated coach, sorted by updated_at DESC
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const getCourses = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const coachId = req.user!.id;

    const result = await query(
      `SELECT id, name, coach_id, weeks, center_id, created_at, updated_at
       FROM courses
       WHERE coach_id = $1
       ORDER BY updated_at DESC`,
      [coachId]
    );

    const courses = result.rows.map(mapCourseRow);
    res.status(200).json({ courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'An error occurred while fetching courses' });
  }
};

/**
 * GET /api/courses/:id
 * Fetch a single course by ID with ownership check
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const getCourseById = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coachId = req.user!.id;

    const result = await query(
      `SELECT id, name, coach_id, weeks, center_id, created_at, updated_at
       FROM courses
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const course = result.rows[0];

    // Ownership check
    if (course.coach_id !== coachId) {
      res.status(403).json({ error: 'Not authorized to access this course' });
      return;
    }

    res.status(200).json(mapCourseRow(course));
  } catch (error) {
    console.error('Get course by ID error:', error);
    res.status(500).json({ error: 'An error occurred while fetching course' });
  }
};

/**
 * PUT /api/courses/:id
 * Update a course (name and/or weeks) with ownership check
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const updateCourse = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, weeks } = req.body;
    const coachId = req.user!.id;

    // Fetch existing course
    const existing = await query(
      `SELECT id, coach_id FROM courses WHERE id = $1`,
      [id]
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Ownership check
    if (existing.rows[0].coach_id !== coachId) {
      res.status(403).json({ error: 'Not authorized to access this course' });
      return;
    }

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Course name is required' });
        return;
      }
      if (name.trim().length > 200) {
        res.status(400).json({ error: 'Course name must not exceed 200 characters' });
        return;
      }
    }

    // Validate weeks if provided
    let numberedWeeks: any[] | undefined;
    if (weeks !== undefined) {
      if (!Array.isArray(weeks) || weeks.length < 1 || weeks.length > 52) {
        res.status(400).json({ error: 'Course must have between 1 and 52 weeks' });
        return;
      }

      // Validate each week structure
      for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i];
        if (!week.focusArea || !week.objective || !Array.isArray(week.drills)) {
          res.status(400).json({
            error: `Week ${i + 1} must have focusArea, objective, and drills array`,
          });
          return;
        }
      }

      // Re-number weeks sequentially starting from 1
      numberedWeeks = weeks.map((week: any, index: number) => ({
        ...week,
        weekNumber: index + 1,
      }));
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(name.trim());
      paramIndex++;
    }

    if (numberedWeeks !== undefined) {
      updates.push(`weeks = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(numberedWeeks));
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    params.push(id);

    const result = await query(
      `UPDATE courses
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, coach_id, weeks, center_id, created_at, updated_at`,
      params
    );

    const course = mapCourseRow(result.rows[0]);
    res.status(200).json(course);
  } catch (error: any) {
    // Handle unique constraint violation (duplicate name per coach)
    if (error.code === '23505' && error.constraint === 'unique_course_name_per_coach') {
      res.status(409).json({ error: 'A course with this name already exists' });
      return;
    }
    console.error('Update course error:', error);
    res.status(500).json({ error: 'An error occurred while updating course' });
  }
};

/**
 * DELETE /api/courses/:id
 * Delete a course after ownership check (hard delete, no cascade to curriculum_plans)
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const deleteCourse = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const coachId = req.user!.id;

    // Fetch existing course for ownership check
    const existing = await query(
      `SELECT id, coach_id FROM courses WHERE id = $1`,
      [id]
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Ownership check
    if (existing.rows[0].coach_id !== coachId) {
      res.status(403).json({ error: 'Not authorized to access this course' });
      return;
    }

    // Hard delete — does NOT cascade to curriculum_plans (they remain)
    await query(`DELETE FROM courses WHERE id = $1`, [id]);

    res.status(200).json({ message: 'Course deleted' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'An error occurred while deleting course' });
  }
};

/**
 * POST /api/courses/:id/attach
 * Attach a course to a batch, creating batch and student curriculum plans
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const attachCourseToBatch = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: courseId } = req.params;
    const { batchId, cycleKey, confirmOverwrite } = req.body;
    const coachId = req.user!.id;
    const centerId = req.tenantCenterId || null;

    // Validate required fields
    if (!batchId || !cycleKey) {
      res.status(400).json({ error: 'batchId and cycleKey are required' });
      return;
    }

    // 1. Validate courseId exists and is owned by the authenticated coach
    const courseResult = await query(
      `SELECT id, name, coach_id, weeks FROM courses WHERE id = $1`,
      [courseId]
    );

    if (courseResult.rowCount === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const course = courseResult.rows[0];

    if (course.coach_id !== coachId) {
      res.status(403).json({ error: 'Not authorized to access this course' });
      return;
    }

    const courseWeeks = typeof course.weeks === 'string'
      ? JSON.parse(course.weeks)
      : course.weeks;

    // 2. Validate batchId exists
    let batchCheck;
    if (centerId) {
      batchCheck = await query(
        `SELECT id FROM batches WHERE id = $1 AND center_id = $2`,
        [batchId, centerId]
      );
    } else {
      batchCheck = await query(
        `SELECT id FROM batches WHERE id = $1`,
        [batchId]
      );
    }

    if (batchCheck.rowCount === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // 3. Check for existing batch-level curriculum_plan for this batch+cycleKey
    const existingPlanResult = await query(
      `SELECT id FROM curriculum_plans
       WHERE batch_id = $1 AND cycle_key = $2 AND student_id IS NULL`,
      [batchId, cycleKey]
    );

    if (existingPlanResult.rowCount! > 0 && !confirmOverwrite) {
      res.status(409).json({
        conflict: true,
        existingPlanId: existingPlanResult.rows[0].id,
        message: 'Batch already has a plan for this cycle. Set confirmOverwrite=true to replace.',
      });
      return;
    }

    // If overwriting, delete existing batch plan and its student plans
    if (existingPlanResult.rowCount! > 0 && confirmOverwrite) {
      const existingPlanId = existingPlanResult.rows[0].id;
      // Delete student plans that reference the old batch plan
      await query(
        `DELETE FROM curriculum_plans WHERE source_batch_plan_id = $1`,
        [existingPlanId]
      );
      // Delete the old batch plan itself
      await query(
        `DELETE FROM curriculum_plans WHERE id = $1`,
        [existingPlanId]
      );
    }

    // 4. Update batches.curriculum_id to the course id
    await query(
      `UPDATE batches SET curriculum_id = $1 WHERE id = $2`,
      [courseId, batchId]
    );

    // 5. Create batch-level curriculum_plan from course weeks
    const batchPlanResult = await query(
      `INSERT INTO curriculum_plans (
        cycle_key, batch_id, student_id, source_batch_plan_id, weeks, is_archived, center_id
      ) VALUES ($1, $2, NULL, NULL, $3::jsonb, false, $4)
      RETURNING
        id, cycle_key, batch_id, student_id, source_batch_plan_id,
        weeks, is_archived, created_at, updated_at`,
      [cycleKey, batchId, JSON.stringify(courseWeeks), centerId]
    );

    const batchPlan = mapPlanRow(batchPlanResult.rows[0]);

    // 6. Fetch all students currently enrolled in the batch
    const studentsResult = await query(
      `SELECT id FROM students WHERE batch_id = $1`,
      [batchId]
    );

    // 7. For each student, create individual curriculum_plan
    const studentPlans: any[] = [];
    for (const student of studentsResult.rows) {
      const studentPlanResult = await query(
        `INSERT INTO curriculum_plans (
          cycle_key, batch_id, student_id, source_batch_plan_id, weeks, is_archived, center_id
        ) VALUES ($1, $2, $3, $4, $5::jsonb, false, $6)
        RETURNING
          id, cycle_key, batch_id, student_id, source_batch_plan_id,
          weeks, is_archived, created_at, updated_at`,
        [cycleKey, batchId, student.id, batchPlan.id, JSON.stringify(courseWeeks), centerId]
      );
      studentPlans.push(mapPlanRow(studentPlanResult.rows[0]));
    }

    // 8. Return 201 with result
    res.status(201).json({
      batchPlan,
      studentPlans,
      message: `Course attached to batch. Created batch plan and ${studentPlans.length} student plan(s).`,
    });
  } catch (error) {
    console.error('Attach course to batch error:', error);
    res.status(500).json({ error: 'An error occurred while attaching course to batch' });
  }
};

/**
 * Helper to map a curriculum_plan database row to the response format
 */
function mapPlanRow(row: any) {
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

/**
 * Helper to map a database row to the course response format
 */
function mapCourseRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    coachId: row.coach_id,
    weeks: typeof row.weeks === 'string' ? JSON.parse(row.weeks) : row.weeks,
    centerId: row.center_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
