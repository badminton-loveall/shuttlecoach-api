import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';
import {
  markAttendance,
  getAttendanceRecords,
  getAttendanceStats,
} from '../services/attendance';

/**
 * POST /api/attendance
 * Create/update attendance records for a batch session.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 */
export const markAttendanceHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, sessionDate, records } = req.body;

    const result = await markAttendance(
      batchId,
      sessionDate,
      records,
      req.user.id
    );

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Mark attendance error:', error);

    if (error.message === 'Batch not found') {
      res.status(404).json({ error: error.message });
      return;
    }

    if (
      error.message === 'Invalid date format' ||
      error.message === 'Cannot mark attendance for dates more than 7 days in the past'
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'An error occurred while marking attendance',
    });
  }
};

/**
 * GET /api/attendance
 * Query attendance records with filters.
 * Allowed roles: ALL (scoped - STUDENT sees only their own records)
 */
export const getAttendanceHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, studentId, startDate, endDate } = req.query;

    // For STUDENT role, scope to their own student_id only
    const filters = {
      batchId: batchId as string | undefined,
      studentId:
        req.user.role === UserRole.STUDENT
          ? req.user.id
          : (studentId as string | undefined),
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    };

    const records = await getAttendanceRecords(filters);

    res.status(200).json(records);
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching attendance records',
    });
  }
};

/**
 * GET /api/attendance/stats
 * Get computed attendance statistics for a batch (or all accessible batches).
 * Allowed roles: ALL (scoped - STUDENT sees only their own stats)
 */
export const getAttendanceStatsHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, studentId, startDate, endDate } = req.query;

    const filters = {
      batchId: batchId as string | undefined,
      studentId: studentId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    };

    // For STUDENT role, scope to their own data regardless of query params
    if (req.user.role === UserRole.STUDENT) {
      filters.studentId = req.user.id;
    }

    let stats = await getAttendanceStats(filters);

    // For STUDENT role, double-check filter to only their own stats
    if (req.user.role === UserRole.STUDENT) {
      stats = stats.filter((s) => s.studentId === req.user!.id);
    }

    res.status(200).json({ stats });
  } catch (error: any) {
    console.error('Get attendance stats error:', error);

    if (error.message === 'Date range cannot exceed 6 months') {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'An error occurred while fetching attendance statistics',
    });
  }
};
