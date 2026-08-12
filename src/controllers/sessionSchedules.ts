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
import { generateTemplateCalendarSessions } from '../services/templateCalendarEngine';

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
 * Query params: batchId (optional), studentId (optional), startDate (optional), endDate (optional)
 * - startDate defaults to 1st of current month
 * - endDate defaults to last day of current month
 * For STUDENT role, automatically scopes to their assigned batch.
 *
 * When a batch has a template_id assigned, sessions are generated on-the-fly
 * from the template's session_slots. When no template is assigned, falls back
 * to the legacy session schedule engine.
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

    // Resolve date range defaults (current month)
    const resolvedStartDate = startDate as string | undefined;
    const resolvedEndDate = endDate as string | undefined;

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
      // Coach with no filter — get batches based on role
      if (req.user.role === 'HEAD_COACH') {
        // HEAD_COACH sees ALL batches in their center (or all if no center)
        if (req.tenantCenterId) {
          const batchResult = await query(
            `SELECT id FROM batches WHERE center_id = $1 AND is_archived = false`,
            [req.tenantCenterId]
          );
          targetBatchIds = batchResult.rows.map((r: any) => r.id);
        } else {
          const batchResult = await query(
            `SELECT id FROM batches WHERE is_archived = false`
          );
          targetBatchIds = batchResult.rows.map((r: any) => r.id);
        }
      } else {
        // ASSISTANT_COACH sees only batches assigned to them
        if (req.tenantCenterId) {
          const batchResult = await query(
            `SELECT id FROM batches WHERE assigned_coach_id = $1 AND center_id = $2 AND is_archived = false`,
            [req.user.id, req.tenantCenterId]
          );
          targetBatchIds = batchResult.rows.map((r: any) => r.id);
        } else {
          const batchResult = await query(
            `SELECT id FROM batches WHERE assigned_coach_id = $1 AND is_archived = false`,
            [req.user.id]
          );
          targetBatchIds = batchResult.rows.map((r: any) => r.id);
        }
      }
    }

    if (targetBatchIds.length === 0) {
      res.status(200).json({ entries: [], sessions: [] });
      return;
    }

    // Generate calendar entries for each batch
    // Check each batch for template_id; if present, use template-based generation
    const allEntries: any[] = [];
    const allTemplateSessions: any[] = [];

    for (const bid of targetBatchIds) {
      // Check if this batch has a template_id
      let batchRow;
      if (req.tenantCenterId) {
        batchRow = await query(
          'SELECT template_id FROM batches WHERE id = $1 AND center_id = $2',
          [bid, req.tenantCenterId]
        );
      } else {
        batchRow = await query(
          'SELECT template_id FROM batches WHERE id = $1',
          [bid]
        );
      }

      const hasTemplate = batchRow.rows.length > 0 && batchRow.rows[0].template_id;

      if (hasTemplate) {
        // Template-based generation: compute sessions from template slots
        const sessions = await generateTemplateCalendarSessions(
          bid,
          resolvedStartDate,
          resolvedEndDate,
          req.tenantCenterId
        );
        allTemplateSessions.push(...sessions);
      } else {
        // Legacy: use the existing calendar engine (requires startDate/endDate)
        if (resolvedStartDate && resolvedEndDate) {
          try {
            const entries = await generateCalendarEntries(
              bid,
              resolvedStartDate,
              resolvedEndDate
            );
            allEntries.push(...entries);
          } catch (err: any) {
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
      }
    }

    // Sort legacy entries by date and start time
    allEntries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    // Template sessions are already sorted by the service

    res.status(200).json({
      entries: allEntries,
      sessions: allTemplateSessions,
    });
  } catch (error: any) {
    console.error('Get session calendar error:', error);
    res.status(500).json({
      error: 'An error occurred while generating the session calendar',
    });
  }
};
