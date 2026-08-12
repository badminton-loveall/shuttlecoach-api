import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';
import { UserRole } from '../types';

/**
 * GET /api/batch-students-drills
 * Returns the list of students in a batch along with their drill assignments
 * for a specific date, derived from curriculum position (week number).
 *
 * Query params: batchId (required), date (required, YYYY-MM-DD)
 * Requires: HEAD_COACH or ASSISTANT_COACH role (must be assigned to the batch,
 *           or HEAD_COACH can access all batches in their center)
 */
export const getBatchStudentsDrills = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, date } = req.query;

    // --- Validate query params ---
    if (!batchId || typeof batchId !== 'string') {
      res.status(400).json({ error: 'Missing required parameter: batchId' });
      return;
    }

    if (!date || typeof date !== 'string') {
      res.status(400).json({ error: 'Missing required parameter: date' });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
      return;
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
      return;
    }

    // --- Authorization check ---
    // HEAD_COACH can access all batches in their center
    // ASSISTANT_COACH must be assigned to the batch
    if (req.user.role === UserRole.HEAD_COACH) {
      // Verify the batch belongs to the coach's center
      const batchCheck = req.tenantCenterId
        ? await query(
            'SELECT id FROM batches WHERE id = $1 AND center_id = $2',
            [batchId, req.tenantCenterId]
          )
        : await query('SELECT id FROM batches WHERE id = $1', [batchId]);

      if (batchCheck.rows.length === 0) {
        res.status(403).json({ error: 'You are not authorized to access this batch' });
        return;
      }
    } else {
      // ASSISTANT_COACH: must be assigned_coach_id on the batch
      const batchCheck = req.tenantCenterId
        ? await query(
            'SELECT id FROM batches WHERE id = $1 AND assigned_coach_id = $2 AND center_id = $3',
            [batchId, req.user.id, req.tenantCenterId]
          )
        : await query(
            'SELECT id FROM batches WHERE id = $1 AND assigned_coach_id = $2',
            [batchId, req.user.id]
          );

      if (batchCheck.rows.length === 0) {
        // Also check batch_coach_assignments table
        const assignmentCheck = await query(
          'SELECT id FROM batch_coach_assignments WHERE batch_id = $1 AND coach_id = $2',
          [batchId, req.user.id]
        );

        if (assignmentCheck.rows.length === 0) {
          res.status(403).json({ error: 'You are not authorized to access this batch' });
          return;
        }
      }
    }

    // --- Get active students in the batch ---
    const studentsResult = await query(
      `SELECT id, full_name, skill_level
       FROM students
       WHERE batch_id = $1 AND status = 'active'
       ORDER BY full_name`,
      [batchId]
    );

    const students = studentsResult.rows;

    // --- Compute week number from cycle_start_date ---
    const scheduleResult = await query(
      `SELECT cycle_start_date FROM session_schedules WHERE batch_id = $1`,
      [batchId]
    );

    let weekNumber: number | null = null;

    if (scheduleResult.rows.length > 0 && scheduleResult.rows[0].cycle_start_date) {
      const cycleStartDate = new Date(scheduleResult.rows[0].cycle_start_date);
      const diffMs = targetDate.getTime() - cycleStartDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Compute week number (1-indexed), clamped to [1, 8]
      const computed = Math.floor(diffDays / 7) + 1;
      weekNumber = Math.max(1, Math.min(8, computed));
    }

    // --- Get drills for each student ---
    const studentsWithDrills = await Promise.all(
      students.map(async (student: any) => {
        let drills: Array<{ name: string; focusArea: string }> = [];

        if (weekNumber !== null) {
          // Try individual student plan first
          let planResult = await query(
            `SELECT weeks FROM curriculum_plans
             WHERE student_id = $1 AND is_archived = false
             ORDER BY created_at DESC LIMIT 1`,
            [student.id]
          );

          // Fallback to batch-level plan
          if (planResult.rows.length === 0) {
            planResult = await query(
              `SELECT weeks FROM curriculum_plans
               WHERE batch_id = $1 AND student_id IS NULL AND is_archived = false
               ORDER BY created_at DESC LIMIT 1`,
              [batchId]
            );
          }

          if (planResult.rows.length > 0) {
            const weeks = typeof planResult.rows[0].weeks === 'string'
              ? JSON.parse(planResult.rows[0].weeks)
              : planResult.rows[0].weeks;

            if (Array.isArray(weeks) && weeks.length >= weekNumber) {
              const weekData = weeks[weekNumber - 1];
              if (weekData && Array.isArray(weekData.drills)) {
                const focusArea = weekData.focusArea || '';
                drills = weekData.drills.map((drill: any) => ({
                  name: typeof drill === 'string' ? drill : drill.name || '',
                  focusArea: drill.focusArea || drill.category || focusArea,
                }));
              }
            }
          }
        }

        return {
          studentId: student.id,
          fullName: student.full_name,
          skillLevel: student.skill_level || 'Beginner',
          drills,
        };
      })
    );

    res.status(200).json({
      students: studentsWithDrills,
    });
  } catch (error) {
    console.error('Get batch students drills error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching student drills',
    });
  }
};
