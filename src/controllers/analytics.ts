import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../types';
import {
  getDrillCompletionStats,
  getTrainingEffectiveness,
  getBatchComparison,
  getStudentComparison,
  getStudentTrends,
  getTrainingPatterns,
} from '../services/analyticsEngine';

/**
 * GET /api/analytics/session/:cycleKey
 * Returns drill completion rates and session-level statistics for a cycle.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 *
 * Query params: batchId (required), weekNumber (optional, 1-8)
 *
 * Requirements: 12.1
 */
export const getDrillCompletionHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { cycleKey } = req.params;
    const { batchId, weekNumber } = req.query;

    if (!batchId) {
      res.status(400).json({ error: 'batchId query parameter is required' });
      return;
    }

    const stats = await getDrillCompletionStats(
      batchId as string,
      decodeURIComponent(cycleKey as string),
      weekNumber ? parseInt(weekNumber as string, 10) : undefined
    );


    res.status(200).json({ stats });
  } catch (error) {
    console.error('Get drill completion stats error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching drill completion statistics',
    });
  }
};

/**
 * GET /api/analytics/effectiveness/:studentId
 * Returns skill improvement correlation for a student.
 * Allowed roles: ALL (scoped - STUDENT can only view their own)
 *
 * Query params: cycleKey (required)
 *
 * Requirements: 12.2, 12.8
 */
export const getEffectivenessHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId } = req.params;
    const { cycleKey } = req.query;

    // STUDENT role: restrict to own data only
    if (req.user.role === UserRole.STUDENT && studentId !== req.user.id) {
      res.status(403).json({
        error: 'You do not have permission to view other students\' analytics',
      });
      return;
    }

    if (!cycleKey) {
      res.status(400).json({ error: 'cycleKey query parameter is required' });
      return;
    }

    const report = await getTrainingEffectiveness(
      studentId as string,
      cycleKey as string
    );

    res.status(200).json(report);
  } catch (error) {
    console.error('Get training effectiveness error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching training effectiveness data',
    });
  }
};

/**
 * GET /api/analytics/comparison/batches
 * Returns batch-level comparison metrics.
 * Allowed roles: HEAD_COACH only
 *
 * Query params: cycleKey (required)
 *
 * Requirements: 12.3
 */
export const getBatchComparisonHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { cycleKey } = req.query;

    if (!cycleKey) {
      res.status(400).json({ error: 'cycleKey query parameter is required' });
      return;
    }

    const batches = await getBatchComparison(cycleKey as string);

    res.status(200).json({ batches });
  } catch (error) {
    console.error('Get batch comparison error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching batch comparison data',
    });
  }
};

/**
 * GET /api/analytics/comparison/students
 * Returns student-level comparison within a batch.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 *
 * Query params: batchId (required), cycleKey (required)
 *
 * Requirements: 12.4
 */
export const getStudentComparisonHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, cycleKey } = req.query;

    if (!batchId) {
      res.status(400).json({ error: 'batchId query parameter is required' });
      return;
    }

    if (!cycleKey) {
      res.status(400).json({ error: 'cycleKey query parameter is required' });
      return;
    }

    const students = await getStudentComparison(
      batchId as string,
      cycleKey as string
    );

    res.status(200).json({ students });
  } catch (error) {
    console.error('Get student comparison error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching student comparison data',
    });
  }
};

/**
 * GET /api/analytics/trends/:studentId
 * Returns attendance vs skill improvement trend data across cycles.
 * Allowed roles: ALL (scoped - STUDENT can only view their own)
 *
 * Requirements: 12.5, 12.8
 */
export const getStudentTrendsHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId } = req.params;

    // STUDENT role: restrict to own data only
    if (req.user.role === UserRole.STUDENT && studentId !== req.user.id) {
      res.status(403).json({
        error: 'You do not have permission to view other students\' analytics',
      });
      return;
    }

    const report = await getStudentTrends(studentId as string);

    res.status(200).json(report);
  } catch (error) {
    console.error('Get student trends error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching student trend data',
    });
  }
};

/**
 * GET /api/analytics/patterns
 * Returns training pattern distributions (category breakdown, attendance heatmap).
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 *
 * Query params: startDate (required), endDate (required), batchId (optional)
 *
 * Requirements: 12.6
 */
export const getTrainingPatternsHandler = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        error: 'startDate and endDate query parameters are required',
      });
      return;
    }

    // If batchId not provided, return empty or aggregated data
    if (!batchId) {
      res.status(400).json({
        error: 'batchId query parameter is required',
      });
      return;
    }

    const report = await getTrainingPatterns(
      batchId as string,
      startDate as string,
      endDate as string
    );

    res.status(200).json({ report });
  } catch (error) {
    console.error('Get training patterns error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching training pattern data',
    });
  }
};
