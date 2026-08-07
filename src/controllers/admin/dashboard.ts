import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

/**
 * GET /api/admin/dashboard
 * Returns aggregate statistics across all centers:
 * - Total active centers, total students, total coaches, total revenue
 * - Per-center breakdown with student count, coach count, monthly revenue
 * Requirements: 7.1, 7.2, 7.4
 */
export const getDashboard = async (
  _req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Aggregate totals using database-level queries
    const [activeCentersResult, totalStudentsResult, totalCoachesResult, totalRevenueResult] =
      await Promise.all([
        query(`SELECT COUNT(*) AS count FROM centers WHERE is_active = true`),
        query(`SELECT COUNT(*) AS count FROM students`),
        query(
          `SELECT COUNT(*) AS count FROM users WHERE role IN ('HEAD_COACH', 'ASSISTANT_COACH')`
        ),
        query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_records WHERE status = 'PAID'`
        ),
      ]);

    const totals = {
      activeCenters: parseInt(activeCentersResult.rows[0].count, 10),
      totalStudents: parseInt(totalStudentsResult.rows[0].count, 10),
      totalCoaches: parseInt(totalCoachesResult.rows[0].count, 10),
      totalRevenue: parseFloat(totalRevenueResult.rows[0].total),
    };

    // Per-center breakdown using JOINs and aggregation grouped by center_id
    const centersResult = await query(`
      SELECT
        c.id,
        c.name,
        COALESCE(s.student_count, 0) AS student_count,
        COALESCE(co.coach_count, 0) AS coach_count,
        COALESCE(r.monthly_revenue, 0) AS monthly_revenue
      FROM centers c
      LEFT JOIN (
        SELECT center_id, COUNT(*) AS student_count
        FROM students
        GROUP BY center_id
      ) s ON s.center_id = c.id
      LEFT JOIN (
        SELECT center_id, COUNT(*) AS coach_count
        FROM users
        WHERE role IN ('HEAD_COACH', 'ASSISTANT_COACH')
        GROUP BY center_id
      ) co ON co.center_id = c.id
      LEFT JOIN (
        SELECT center_id, COALESCE(SUM(amount), 0) AS monthly_revenue
        FROM fee_records
        WHERE status = 'PAID'
          AND month_year = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        GROUP BY center_id
      ) r ON r.center_id = c.id
      WHERE c.is_active = true
      ORDER BY c.name ASC
    `);

    const centers = centersResult.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      studentCount: parseInt(row.student_count, 10),
      coachCount: parseInt(row.coach_count, 10),
      monthlyRevenue: parseFloat(row.monthly_revenue),
    }));

    res.status(200).json({ totals, centers });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching dashboard data',
    });
  }
};
