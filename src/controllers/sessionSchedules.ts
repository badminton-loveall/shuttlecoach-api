import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantScope';
import { UserRole } from '../types';
import { query } from '../config/database';
import {
  createOrUpdateSchedule,
  getSchedule,
  recomputeMappingsOnUpdate,
} from '../services/sessionSchedules';
import { generateCalendarEntries } from '../services/calendarEngine';

/**
 * POST /api/session-schedules
 * Create or update a session schedule for a batch.
 * Allowed roles: HEAD_COACH only
 *
 * After upserting, triggers recomputeMappingsOnUpdate to refresh
 * curriculum week mappings for future dates.
 */
export const createSessionScheduleHandler = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, slots, recurrence, cycleStartDate } = req.body;

    // Verify batch exists (with tenant scoping)
    let batchCheck;
    if (req.tenantCenterId) {
      batchCheck = await query('SELECT id FROM batches WHERE id = $1 AND center_id = $2', [batchId, req.tenantCenterId]);
    } else {
      batchCheck = await query('SELECT id FROM batches WHERE id = $1', [batchId]);
    }
    if (batchCheck.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    // Create or update schedule
    const schedule = await createOrUpdateSchedule(batchId, slots, recurrence, cycleStartDate, req.tenantCenterId);

    // Trigger recomputation of curriculum week mappings for future dates
    await recomputeMappingsOnUpdate(batchId);

    res.status(200).json(schedule);
  } catch (error: any) {
    console.error('Create session schedule error:', error);
    res.status(500).json({
      error: 'An error occurred while creating/updating the session schedule',
    });
  }
};

/**
 * GET /api/session-schedules/:batchId
 * Retrieve the structured session schedule for a batch.
 * Allowed roles: ALL authenticated users
 */
export const getSessionScheduleHandler = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const batchId = req.params.batchId as string;

    // Verify batch exists (with tenant scoping)
    let batchCheck;
    if (req.tenantCenterId) {
      batchCheck = await query('SELECT id FROM batches WHERE id = $1 AND center_id = $2', [batchId, req.tenantCenterId]);
    } else {
      batchCheck = await query('SELECT id FROM batches WHERE id = $1', [batchId]);
    }
    if (batchCheck.rows.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    const schedule = await getSchedule(batchId);

    if (!schedule) {
      res.status(404).json({ error: 'No session schedule found for this batch' });
      return;
    }

    res.status(200).json(schedule);
  } catch (error: any) {
    console.error('Get session schedule error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching the session schedule',
    });
  }
};

/**
 * GET /api/session-calendar
 * Get calendar data with mapped curriculum drills for a date range.
 * Allowed roles: ALL authenticated users (scoped - STUDENT sees only their batch)
 *
 * Query params: batchId (optional), studentId (optional), startDate (required), endDate (required)
 * For STUDENT role, automatically scopes to their assigned batch.
 */
export const getSessionCalendarHandler = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, studentId, startDate, endDate } = req.query;

    // Determine which batch(es) to query
    let targetBatchIds: string[] = [];

    if (req.user.role === UserRole.STUDENT) {
      // Students can only view calendar for their own batch
      const studentConditions = ['id = $1'];
      const studentParams: any[] = [req.user.id];

      if (req.tenantCenterId) {
        studentConditions.push('center_id = $2');
        studentParams.push(req.tenantCenterId);
      }

      const studentResult = await query(
        `SELECT batch_id FROM students WHERE ${studentConditions.join(' AND ')}`,
        studentParams
      );
      if (studentResult.rows.length === 0) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }
      const studentBatchId = studentResult.rows[0].batch_id;
      if (studentBatchId) {
        targetBatchIds = [studentBatchId];
      }
    } else if (batchId) {
      // Coach specified a batch — verify it belongs to the tenant
      if (req.tenantCenterId) {
        const batchCheck = await query(
          'SELECT id FROM batches WHERE id = $1 AND center_id = $2',
          [batchId as string, req.tenantCenterId]
        );
        if (batchCheck.rows.length > 0) {
          targetBatchIds = [batchId as string];
        }
      } else {
        targetBatchIds = [batchId as string];
      }
    } else if (studentId) {
      // Coach querying for a specific student's batch
      const studentResult = await query(
        `SELECT batch_id FROM students WHERE id = $1`,
        [studentId as string]
      );
      if (studentResult.rows.length > 0 && studentResult.rows[0].batch_id) {
        targetBatchIds = [studentResult.rows[0].batch_id];
      }
    } else {
      // Coach with no filter - get all assigned batches (with tenant scoping)
      if (req.tenantCenterId) {
        const batchResult = await query(
          `SELECT id FROM batches WHERE (head_coach_id = $1 OR assistant_coach_id = $1) AND center_id = $2`,
          [req.user.id, req.tenantCenterId]
        );
        targetBatchIds = batchResult.rows.map((r: any) => r.id);
      } else {
        const batchResult = await query(
          `SELECT id FROM batches WHERE head_coach_id = $1 OR assistant_coach_id = $1`,
          [req.user.id]
        );
        targetBatchIds = batchResult.rows.map((r: any) => r.id);
      }
    }

    if (targetBatchIds.length === 0) {
      res.status(200).json({ entries: [] });
      return;
    }

    // Generate calendar entries for each batch
    const allEntries = [];
    for (const bid of targetBatchIds) {
      try {
        const entries = await generateCalendarEntries(
          bid,
          startDate as string,
          endDate as string
        );
        allEntries.push(...entries);
      } catch (err: any) {
        // If a single batch fails (e.g., no schedule), skip it
        if (err.message?.includes('Calendar generation limited')) {
          res.status(400).json({ error: err.message });
          return;
        }
        if (err.message?.includes('Invalid date format')) {
          res.status(400).json({ error: err.message });
          return;
        }
        if (err.message?.includes('endDate must be on or after startDate')) {
          res.status(400).json({ error: err.message });
          return;
        }
        // Silently skip batches with no schedule or other non-critical issues
      }
    }

    // Sort entries by date and start time
    allEntries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    res.status(200).json({ entries: allEntries });
  } catch (error: any) {
    console.error('Get session calendar error:', error);
    res.status(500).json({
      error: 'An error occurred while generating the session calendar',
    });
  }
};
