import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';
import { UserRole } from '../types';
import { computeWeekSchedule } from '../services/enrollmentService';

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

    // --- Batch-level week number, used only as a fallback for students with no active
    // enrollment of their own (e.g. legacy batch-level curriculum, never migrated to the
    // per-student journey system). ---
    let batchWeekNumber: number | null = null;

    const scheduleResult = await query(
      `SELECT cycle_start_date FROM session_schedules WHERE batch_id = $1`,
      [batchId]
    );
    if (scheduleResult.rows.length > 0 && scheduleResult.rows[0].cycle_start_date) {
      const cycleStartDate = new Date(scheduleResult.rows[0].cycle_start_date);
      const diffMs = targetDate.getTime() - cycleStartDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const computed = Math.floor(diffDays / 7) + 1;
      batchWeekNumber = Math.max(1, Math.min(8, computed));
    }
    if (batchWeekNumber === null) {
      const batchCreatedResult = await query(
        `SELECT created_at FROM batches WHERE id = $1`,
        [batchId]
      );
      if (batchCreatedResult.rows.length > 0 && batchCreatedResult.rows[0].created_at) {
        const createdAt = new Date(batchCreatedResult.rows[0].created_at);
        const diffMs = targetDate.getTime() - createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          const computed = Math.floor(diffDays / 7) + 1;
          batchWeekNumber = Math.max(1, Math.min(8, computed));
        }
      }
    }

    // --- Get drills for each student ---
    const studentsWithDrills = await Promise.all(
      students.map(async (student: any) => {
        let drills: Array<{ name: string; focusArea: string }> = [];

        // Prefer this student's own active enrollment + curriculum plan, with week
        // boundaries computed from their own enrollment start date — the same math used
        // when their drill ledger was created — rather than any batch-wide date.
        const enrollmentResult = await query(
          `SELECT start_date FROM student_enrollments WHERE student_id = $1 AND status = 'active'`,
          [student.id]
        );
        const planResultOwn = await query(
          `SELECT weeks FROM curriculum_plans
           WHERE student_id = $1 AND is_archived = false
           ORDER BY created_at DESC LIMIT 1`,
          [student.id]
        );

        let weekNumber: number | null = null;
        let weeks: any = null;

        if (enrollmentResult.rows.length > 0 && planResultOwn.rows.length > 0) {
          weeks = typeof planResultOwn.rows[0].weeks === 'string'
            ? JSON.parse(planResultOwn.rows[0].weeks)
            : planResultOwn.rows[0].weeks;

          if (Array.isArray(weeks) && weeks.length > 0) {
            const enrollmentStart = new Date(enrollmentResult.rows[0].start_date);
            const schedule = computeWeekSchedule(enrollmentStart, weeks.length);
            const dateStr = date;
            const weekEntry = schedule.find(
              (w) => dateStr >= w.scheduledStart && dateStr <= w.scheduledEnd
            );
            weekNumber = weekEntry?.weekNumber ?? null;
          }
        }

        // Fall back to the legacy batch-level plan + batch-wide week number
        if (weekNumber === null) {
          weekNumber = batchWeekNumber;
          weeks = null;

          if (weekNumber !== null) {
            let planResult = await query(
              `SELECT weeks FROM curriculum_plans
               WHERE batch_id = $1 AND student_id IS NULL AND is_archived = false
               ORDER BY created_at DESC LIMIT 1`,
              [batchId]
            );

            if (planResult.rows.length === 0) {
              planResult = await query(
                `SELECT c.weeks FROM courses c
                 INNER JOIN batches b ON b.curriculum_id = c.id
                 WHERE b.id = $1`,
                [batchId]
              );
            }

            if (planResult.rows.length > 0) {
              weeks = typeof planResult.rows[0].weeks === 'string'
                ? JSON.parse(planResult.rows[0].weeks)
                : planResult.rows[0].weeks;
            }
          }
        }

        if (weekNumber !== null && Array.isArray(weeks) && weeks.length >= weekNumber) {
          const weekData = weeks[weekNumber - 1];
          if (weekData && Array.isArray(weekData.drills)) {
            const focusArea = weekData.focusArea || '';
            drills = weekData.drills.map((drill: any) => ({
              name: typeof drill === 'string' ? drill : drill.name || '',
              focusArea: drill.focusArea || drill.category || focusArea,
            }));
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
