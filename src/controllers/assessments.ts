import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { SkillAssessment, SkillScores } from '../types';

/**
 * Helper function to get current cycle key
 * Format: "Jan-Feb 2025"
 */
function getCurrentCycleKey(): string {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  const cycles = [
    'Jan-Feb',
    'Jan-Feb',
    'Mar-Apr',
    'Mar-Apr',
    'May-Jun',
    'May-Jun',
    'Jul-Aug',
    'Jul-Aug',
    'Sep-Oct',
    'Sep-Oct',
    'Nov-Dec',
    'Nov-Dec',
  ];

  return `${cycles[month]} ${year}`;
}

/**
 * Helper function to check if a cycle is in the past
 */
function isPastCycle(cycleKey: string): boolean {
  const currentCycle = getCurrentCycleKey();
  
  // Parse cycle keys: "Jan-Feb 2025"
  const parseRe = /^(\w{3})-(\w{3})\s+(\d{4})$/;
  const currentMatch = currentCycle.match(parseRe);
  const cycleMatch = cycleKey.match(parseRe);
  
  if (!currentMatch || !cycleMatch) {
    return false;
  }
  
  const currentYear = parseInt(currentMatch[3], 10);
  const cycleYear = parseInt(cycleMatch[3], 10);
  
  // If year is less, it's past
  if (cycleYear < currentYear) {
    return true;
  }
  
  // If year is greater, it's future
  if (cycleYear > currentYear) {
    return false;
  }
  
  // Same year - compare cycles
  const cycleOrder = ['Jan-Feb', 'Mar-Apr', 'May-Jun', 'Jul-Aug', 'Sep-Oct', 'Nov-Dec'];
  const currentCycleName = currentMatch[1] + '-' + currentMatch[2];
  const cycleName = cycleMatch[1] + '-' + cycleMatch[2];
  
  const currentIndex = cycleOrder.indexOf(currentCycleName);
  const cycleIndex = cycleOrder.indexOf(cycleName);
  
  return cycleIndex < currentIndex;
}

/**
 * POST /api/assessments
 * Create a new skill assessment snapshot
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 * Rejects: Assessments for past cycles (returns 403)
 */
export const createAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId, cycleKey, scores } = req.body;

    // Validate required fields
    if (!studentId || !cycleKey || !scores) {
      res.status(400).json({
        error: 'Missing required fields: studentId, cycleKey, scores',
      });
      return;
    }

    // Validate scores structure
    if (!validateScoresStructure(scores)) {
      res.status(400).json({
        error:
          'Invalid scores structure. Must contain forehand, backhand, return, service, overhead, and rally categories with skill scores 0-4',
      });
      return;
    }

    // Check if cycle is in the past
    if (isPastCycle(cycleKey)) {
      res.status(403).json({
        error: 'Cannot create assessment for past cycles. Past cycle snapshots are locked.',
      });
      return;
    }

    // Check if student exists
    const studentCheck = await query('SELECT id FROM students WHERE id = $1', [studentId]);
    if (studentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Check if assessment already exists for this student and cycle
    const existingCheck = await query(
      'SELECT id FROM skill_assessments WHERE student_id = $1 AND cycle_key = $2',
      [studentId, cycleKey]
    );

    if (existingCheck.rows.length > 0) {
      res.status(409).json({
        error: 'Assessment already exists for this student and cycle. Use PATCH to update.',
      });
      return;
    }

    // Insert assessment
    const result = await query(
      `INSERT INTO skill_assessments (
        student_id, cycle_key, recorded_by, scores, is_locked
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, student_id, cycle_key, recorded_by, recorded_at, scores, is_locked`,
      [studentId, cycleKey, req.user.username, scores, isPastCycle(cycleKey)]
    );

    const assessment = mapDatabaseRowToAssessment(result.rows[0]);
    res.status(201).json(assessment);
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({
      error: 'An error occurred while creating assessment',
    });
  }
};

/**
 * GET /api/assessments
 * Query assessments with optional filtering
 * Query params: ?studentId=<id>&cycleKey=<key>
 * Returns: Array of assessments
 */
export const listAssessments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId, cycleKey } = req.query;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (studentId) {
      conditions.push(`student_id = $${paramIndex}`);
      params.push(studentId);
      paramIndex++;
    }

    if (cycleKey) {
      conditions.push(`cycle_key = $${paramIndex}`);
      params.push(cycleKey);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch assessments
    const result = await query(
      `SELECT id, student_id, cycle_key, recorded_by, recorded_at, scores, is_locked
      FROM skill_assessments
      ${whereClause}
      ORDER BY recorded_at DESC`,
      params
    );

    const assessments = result.rows.map(mapDatabaseRowToAssessment);
    res.status(200).json(assessments);
  } catch (error) {
    console.error('List assessments error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching assessments',
    });
  }
};

/**
 * GET /api/assessments/:id
 * Fetch a single assessment by ID
 */
export const getAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const result = await query(
      `SELECT id, student_id, cycle_key, recorded_by, recorded_at, scores, is_locked
      FROM skill_assessments
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    const assessment = mapDatabaseRowToAssessment(result.rows[0]);
    res.status(200).json(assessment);
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching assessment',
    });
  }
};

/**
 * PATCH /api/assessments/:id
 * Update an assessment (rejects if locked or past cycle)
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const updateAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { scores } = req.body;

    if (!scores) {
      res.status(400).json({ error: 'No scores provided for update' });
      return;
    }

    // Validate scores structure
    if (!validateScoresStructure(scores)) {
      res.status(400).json({
        error:
          'Invalid scores structure. Must contain forehand, backhand, return, service, overhead, and rally categories with skill scores 0-4',
      });
      return;
    }

    // Check if assessment exists and get cycle info
    const existingResult = await query(
      'SELECT id, cycle_key, is_locked FROM skill_assessments WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Assessment not found' });
      return;
    }

    const existing = existingResult.rows[0];

    // Check if cycle is past or locked
    if (existing.is_locked || isPastCycle(existing.cycle_key)) {
      res.status(403).json({
        error: 'Cannot update assessment for past cycles. Past cycle snapshots are locked.',
      });
      return;
    }

    // Update assessment
    const result = await query(
      `UPDATE skill_assessments
      SET scores = $1, recorded_by = $2, recorded_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, student_id, cycle_key, recorded_by, recorded_at, scores, is_locked`,
      [scores, req.user.username, id]
    );

    const assessment = mapDatabaseRowToAssessment(result.rows[0]);
    res.status(200).json(assessment);
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({
      error: 'An error occurred while updating assessment',
    });
  }
};

/**
 * Helper function to validate scores structure
 */
function validateScoresStructure(scores: any): boolean {
  if (!scores || typeof scores !== 'object') {
    return false;
  }

  const requiredCategories = ['forehand', 'backhand', 'return', 'service', 'overhead', 'rally'];

  for (const category of requiredCategories) {
    if (!scores[category] || typeof scores[category] !== 'object') {
      return false;
    }

    // Check that all scores are 0-4
    for (const skillName in scores[category]) {
      const score = scores[category][skillName];
      if (typeof score !== 'number' || score < 0 || score > 4 || !Number.isInteger(score)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Helper function to map database row to SkillAssessment type
 */
function mapDatabaseRowToAssessment(row: any): SkillAssessment {
  return {
    id: row.id,
    studentId: row.student_id,
    cycleKey: row.cycle_key,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    scores: row.scores as SkillScores,
    isLocked: row.is_locked,
  };
}
