import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * POST /api/skill-scores
 * Record weekly skill scores for a student (batch upsert)
 * Uses ON CONFLICT to update existing scores for the same (student, cycle, week, skill)
 */
export const recordSkillScores = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { studentId, cycleKey, weekNumber, scores } = req.body;
    const recordedBy = req.user!.id;

    // Verify student exists
    const studentCheck = await query(
      'SELECT id FROM students WHERE id = $1',
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(400).json({
        error: 'Student not found',
        message: `No student exists with ID: ${studentId}`,
      });
      return;
    }

    // Build batch upsert query
    const values: unknown[] = [];
    const valuePlaceholders: string[] = [];
    let paramIndex = 1;

    for (const entry of scores) {
      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`
      );
      values.push(
        studentId,
        weekNumber,
        cycleKey,
        entry.skillId,
        entry.skillName,
        entry.category,
        entry.score,
        recordedBy
      );
      paramIndex += 8;
    }

    const upsertQuery = `
      INSERT INTO weekly_skill_scores (
        student_id, week_number, cycle_key, skill_id, skill_name, category, score, recorded_by
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (student_id, cycle_key, week_number, skill_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        skill_name = EXCLUDED.skill_name,
        category = EXCLUDED.category,
        recorded_by = EXCLUDED.recorded_by,
        recorded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `;

    await query(upsertQuery, values);

    res.status(201).json({
      message: `Recorded ${scores.length} skill scores for week ${weekNumber}`,
      count: scores.length,
    });
  } catch (error) {
    console.error('Record skill scores error:', error);
    res.status(500).json({
      error: 'Failed to record skill scores',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/skill-scores
 * Retrieve skill scores for a student, optionally filtered by cycle
 */
export const getSkillScores = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { studentId, cycleKey } = req.query;

    let scoresQuery: string;
    let params: unknown[];

    if (cycleKey) {
      scoresQuery = `
        SELECT id, week_number, cycle_key, skill_id, skill_name, category, score, recorded_by, recorded_at
        FROM weekly_skill_scores
        WHERE student_id = $1 AND cycle_key = $2
        ORDER BY category, skill_id, week_number
      `;
      params = [studentId, cycleKey];
    } else {
      scoresQuery = `
        SELECT id, week_number, cycle_key, skill_id, skill_name, category, score, recorded_by, recorded_at
        FROM weekly_skill_scores
        WHERE student_id = $1
        ORDER BY category, skill_id, cycle_key, week_number
      `;
      params = [studentId];
    }

    const result = await query(scoresQuery, params);

    // Get distinct cycles for this student
    const cyclesResult = await query(
      `SELECT DISTINCT cycle_key FROM weekly_skill_scores WHERE student_id = $1 ORDER BY cycle_key`,
      [studentId]
    );

    const cycles = cyclesResult.rows.map((row: { cycle_key: string }) => row.cycle_key);

    const scores = result.rows.map((row: {
      id: string;
      week_number: number;
      cycle_key: string;
      skill_id: string;
      skill_name: string;
      category: string;
      score: number;
      recorded_by: string;
      recorded_at: string;
    }) => ({
      id: row.id,
      weekNumber: row.week_number,
      cycleKey: row.cycle_key,
      skillId: row.skill_id,
      skillName: row.skill_name,
      category: row.category,
      score: row.score,
      recordedBy: row.recorded_by,
      recordedAt: row.recorded_at,
    }));

    res.status(200).json({
      studentId,
      totalRecords: scores.length,
      cycles,
      scores,
    });
  } catch (error) {
    console.error('Get skill scores error:', error);
    res.status(500).json({
      error: 'Failed to retrieve skill scores',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * GET /api/skill-scores/timeline
 * Get the full history of a single skill across all cycles for timeline chart rendering
 */
export const getSkillTimeline = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { studentId, skillId } = req.query;

    const result = await query(
      `SELECT cycle_key, week_number, score, recorded_at, skill_name, category
       FROM weekly_skill_scores
       WHERE student_id = $1 AND skill_id = $2
       ORDER BY cycle_key, week_number`,
      [studentId, skillId]
    );

    if (result.rows.length === 0) {
      res.status(200).json({
        studentId,
        skillId,
        skillName: null,
        category: null,
        timeline: [],
      });
      return;
    }

    const firstRow = result.rows[0] as { skill_name: string; category: string };

    const timeline = result.rows.map((row: {
      cycle_key: string;
      week_number: number;
      score: number;
      recorded_at: string;
    }) => ({
      cycleKey: row.cycle_key,
      weekNumber: row.week_number,
      score: row.score,
      recordedAt: row.recorded_at,
    }));

    res.status(200).json({
      studentId,
      skillId,
      skillName: firstRow.skill_name,
      category: firstRow.category,
      timeline,
    });
  } catch (error) {
    console.error('Get skill timeline error:', error);
    res.status(500).json({
      error: 'Failed to retrieve skill timeline',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
