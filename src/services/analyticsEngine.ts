import { query } from '../config/database';
import {
  SkillScores,
  SkillImprovementDelta,
  TrainingEffectivenessReport,
  DrillCompletionStats,
  BatchComparisonMetric,
  StudentTrendReport,
  TrendDataPoint,
  TrainingPatternReport,
  CategoryDistribution,
  DayOfWeek,
  WeekPlan,
} from '../types';

// ============================================================
// Skill Assessment Categories (matching SkillScores keys)
// ============================================================

const SKILL_CATEGORIES = ['forehand', 'backhand', 'return', 'service', 'overhead', 'rally'] as const;

// ============================================================
// Drill Completion Stats
// ============================================================

/**
 * Computes drill completion stats for a batch in a given cycle.
 * Optionally filtered by week number.
 *
 * For each week:
 * 1. Fetch planned drills from curriculum_plans.weeks[weekNumber]
 * 2. Count completed training_logs for that week
 * 3. completionRate = completedLogs / totalStudentsWithPlan * 100
 *
 * Requirements: 6.1, 6.2
 */
export async function getDrillCompletionStats(
  batchId: string,
  cycleKey: string,
  weekNumber?: number,
  centerId?: string
): Promise<DrillCompletionStats[]> {
  // Fetch the batch curriculum plan (with tenant scoping)
  let planResult;
  if (centerId) {
    planResult = await query(
      `SELECT weeks FROM curriculum_plans
       WHERE batch_id = $1 AND cycle_key = $2 AND student_id IS NULL AND center_id = $3
       LIMIT 1`,
      [batchId, cycleKey, centerId]
    );
  } else {
    planResult = await query(
      `SELECT weeks FROM curriculum_plans
       WHERE batch_id = $1 AND cycle_key = $2 AND student_id IS NULL
       LIMIT 1`,
      [batchId, cycleKey]
    );
  }

  if (planResult.rows.length === 0) {
    return [];
  }

  const weeks: WeekPlan[] =
    typeof planResult.rows[0].weeks === 'string'
      ? JSON.parse(planResult.rows[0].weeks)
      : planResult.rows[0].weeks;

  // Filter to specific week if requested
  const targetWeeks = weekNumber
    ? weeks.filter((w) => w.weekNumber === weekNumber)
    : weeks;

  // Get students in the batch
  const studentsResult = await query(
    `SELECT id FROM students WHERE batch_id = $1 AND status != 'INACTIVE'`,
    [batchId]
  );

  const studentIds = studentsResult.rows.map((r: any) => r.id);
  if (studentIds.length === 0) {
    return targetWeeks.map((w) => ({
      weekNumber: w.weekNumber,
      focusArea: w.focusArea,
      totalDrills: w.drills.length,
      completedDrills: 0,
      completionRate: 0,
      drills: w.drills.map((d) => ({
        name: d.name,
        category: d.category,
        completed: false,
      })),
    }));
  }

  const stats: DrillCompletionStats[] = [];

  for (const week of targetWeeks) {
    // Get completed training logs for this week
    const logsResult = await query(
      `SELECT student_id, session_notes, is_completed
       FROM training_logs
       WHERE student_id = ANY($1) AND cycle_key = $2 AND week_number = $3`,
      [studentIds, cycleKey, week.weekNumber]
    );

    const completedLogs = logsResult.rows.filter((r: any) => r.is_completed);

    // A drill is considered "completed" if at least one student has a completed training log for that week
    // More granular: count unique students with completed logs / total students
    const completedStudentCount = completedLogs.length;
    const totalStudentCount = studentIds.length;

    // Drill-level completion: check if drill name appears in session notes
    const drillDetails = week.drills.map((drill) => {
      const drillMentioned = completedLogs.some(
        (log: any) =>
          log.session_notes &&
          log.session_notes.toLowerCase().includes(drill.name.toLowerCase())
      );
      return {
        name: drill.name,
        category: drill.category,
        completed: drillMentioned || completedStudentCount > 0,
        notes: drillMentioned
          ? completedLogs.find(
              (log: any) =>
                log.session_notes &&
                log.session_notes.toLowerCase().includes(drill.name.toLowerCase())
            )?.session_notes
          : undefined,
      };
    });

    // Completion rate: ratio of completed training logs to total expected
    // Each student should have one log per week, so total = studentCount
    const completionRate =
      totalStudentCount > 0
        ? Math.round((completedStudentCount / totalStudentCount) * 1000) / 10
        : 0;

    stats.push({
      weekNumber: week.weekNumber,
      focusArea: week.focusArea,
      totalDrills: week.drills.length,
      completedDrills: drillDetails.filter((d) => d.completed).length,
      completionRate,
      drills: drillDetails,
    });
  }

  return stats;
}

// ============================================================
// Skill Improvement Correlation (Training Effectiveness)
// ============================================================

/**
 * Computes training effectiveness for a student in a given cycle.
 *
 * Algorithm:
 * 1. Fetch skill_assessments for the student sorted by recorded_at
 * 2. Identify the "current" cycle assessment and the "previous" cycle assessment
 * 3. For each skill category, compute delta = currentAvg - previousAvg
 * 4. For each category, find related drills from curriculum_plan
 * 5. Compute category drill completion rate from training_logs
 * 6. Training_Effectiveness_Score = weighted average of (delta * drillCompletionRate) across categories
 *
 * Returns insufficientData: true if < 2 assessments exist.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */
export async function getTrainingEffectiveness(
  studentId: string,
  cycleKey: string,
  _centerId?: string
): Promise<TrainingEffectivenessReport> {
  // Fetch all skill assessments for this student, ordered by recorded_at
  const assessmentsResult = await query(
    `SELECT id, cycle_key, scores, recorded_at
     FROM skill_assessments
     WHERE student_id = $1
     ORDER BY recorded_at ASC`,
    [studentId]
  );

  const assessments = assessmentsResult.rows;

  // Insufficient data guard: need at least 2 assessments
  if (assessments.length < 2) {
    return {
      studentId,
      cycleKey,
      overallScore: 0,
      categories: [],
      insufficientData: true,
    };
  }

  // Find the target cycle assessment and the one before it
  const targetIndex = assessments.findIndex(
    (a: any) => a.cycle_key === cycleKey
  );

  // If the target cycle doesn't exist or is the first assessment, insufficient data
  if (targetIndex < 1) {
    // If target cycle not found, try using the last two assessments
    if (targetIndex === -1 && assessments.length >= 2) {
      // Use the two most recent assessments
      const endAssessment = assessments[assessments.length - 1];
      const startAssessment = assessments[assessments.length - 2];
      return computeEffectiveness(
        studentId,
        cycleKey,
        startAssessment,
        endAssessment
      );
    }
    return {
      studentId,
      cycleKey,
      overallScore: 0,
      categories: [],
      insufficientData: true,
    };
  }

  const endAssessment = assessments[targetIndex];
  const startAssessment = assessments[targetIndex - 1];

  return computeEffectiveness(studentId, cycleKey, startAssessment, endAssessment);
}

/**
 * Internal: Computes effectiveness between two assessments.
 */
async function computeEffectiveness(
  studentId: string,
  cycleKey: string,
  startAssessment: any,
  endAssessment: any
): Promise<TrainingEffectivenessReport> {
  const startScores: SkillScores =
    typeof startAssessment.scores === 'string'
      ? JSON.parse(startAssessment.scores)
      : startAssessment.scores;

  const endScores: SkillScores =
    typeof endAssessment.scores === 'string'
      ? JSON.parse(endAssessment.scores)
      : endAssessment.scores;

  // Get the student's curriculum plan for this cycle (or batch plan)
  const planResult = await query(
    `SELECT weeks FROM curriculum_plans
     WHERE (student_id = $1 OR batch_id IN (SELECT batch_id FROM students WHERE id = $1))
       AND cycle_key = $2
     ORDER BY student_id DESC NULLS LAST
     LIMIT 1`,
    [studentId, cycleKey]
  );

  const weeks: WeekPlan[] =
    planResult.rows.length > 0
      ? typeof planResult.rows[0].weeks === 'string'
        ? JSON.parse(planResult.rows[0].weeks)
        : planResult.rows[0].weeks
      : [];

  // Get training logs for this student and cycle
  const logsResult = await query(
    `SELECT week_number, is_completed
     FROM training_logs
     WHERE student_id = $1 AND cycle_key = $2`,
    [studentId, cycleKey]
  );

  const completedWeeks = new Set(
    logsResult.rows
      .filter((r: any) => r.is_completed)
      .map((r: any) => r.week_number)
  );

  // Compute per-category deltas and related drill info
  const categories: SkillImprovementDelta[] = [];

  for (const category of SKILL_CATEGORIES) {
    const startCategoryScores = startScores[category] || {};
    const endCategoryScores = endScores[category] || {};

    // Compute average score for start and end
    const startAvg = computeCategoryAverage(startCategoryScores);
    const endAvg = computeCategoryAverage(endCategoryScores);
    const delta = Math.round((endAvg - startAvg) * 100) / 100;

    // Find drills related to this category from curriculum plan
    const relatedDrills = findRelatedDrills(weeks, category);

    // Compute drill completion rate for this category
    // A drill week is "completed" if the training_log for that week is marked completed
    const drillWeeks = findDrillWeeks(weeks, category);
    const completedDrillWeeks = drillWeeks.filter((wn) => completedWeeks.has(wn));
    const drillCompletionRate =
      drillWeeks.length > 0
        ? Math.round((completedDrillWeeks.length / drillWeeks.length) * 1000) / 10
        : 0;

    categories.push({
      category,
      startScore: Math.round(startAvg * 100) / 100,
      endScore: Math.round(endAvg * 100) / 100,
      delta,
      relatedDrills,
      drillCompletionRate,
    });
  }

  // Compute Training Effectiveness Score
  // Weighted average of (delta * drillCompletionRate / 100) across categories
  const overallScore = computeTrainingEffectivenessScore(categories);

  return {
    studentId,
    cycleKey,
    overallScore,
    categories,
    insufficientData: false,
  };
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Computes the average score for all skills in a category.
 */
function computeCategoryAverage(categoryScores: Record<string, number>): number {
  const values = Object.values(categoryScores);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Finds drill names related to a skill category from the curriculum plan weeks.
 * Maps drill.category to skill assessment categories by checking for keyword matches.
 */
function findRelatedDrills(weeks: WeekPlan[], skillCategory: string): string[] {
  const drillNames: Set<string> = new Set();

  for (const week of weeks) {
    for (const drill of week.drills) {
      if (isDrillRelatedToCategory(drill.category, skillCategory)) {
        drillNames.add(drill.name);
      }
    }
  }

  return Array.from(drillNames);
}

/**
 * Finds week numbers that contain drills related to a given skill category.
 */
function findDrillWeeks(weeks: WeekPlan[], skillCategory: string): number[] {
  const weekNumbers: Set<number> = new Set();

  for (const week of weeks) {
    for (const drill of week.drills) {
      if (isDrillRelatedToCategory(drill.category, skillCategory)) {
        weekNumbers.add(week.weekNumber);
        break;
      }
    }
  }

  return Array.from(weekNumbers);
}

/**
 * Determines if a drill category maps to a skill assessment category.
 * Drill categories (e.g., "Footwork", "Stroke Practice", "Technique") are mapped
 * to assessment categories (forehand, backhand, return, service, overhead, rally).
 *
 * Mapping logic:
 * - Drills with "forehand" in name/category -> forehand
 * - Drills with "backhand" in name/category -> backhand
 * - Drills with "serve"/"service" in category -> service
 * - Drills with "overhead"/"smash"/"clear" in category -> overhead
 * - Drills with "return" in category -> return
 * - Drills with "rally"/"defense"/"footwork" in category -> rally
 * - "Stroke Practice" and "Technique" -> forehand (default)
 */
function isDrillRelatedToCategory(
  drillCategory: string,
  skillCategory: string
): boolean {
  const dc = drillCategory.toLowerCase();
  const sc = skillCategory.toLowerCase();

  // Direct match
  if (dc.includes(sc)) return true;

  // Specific mappings
  switch (sc) {
    case 'forehand':
      return dc.includes('forehand') || dc.includes('stroke') || dc.includes('technique');
    case 'backhand':
      return dc.includes('backhand');
    case 'service':
      return dc.includes('serve') || dc.includes('service');
    case 'overhead':
      return dc.includes('overhead') || dc.includes('smash') || dc.includes('clear');
    case 'return':
      return dc.includes('return') || dc.includes('receive');
    case 'rally':
      return dc.includes('rally') || dc.includes('defense') || dc.includes('footwork') || dc.includes('movement');
    default:
      return false;
  }
}

/**
 * Computes the Training Effectiveness Score.
 * Formula: weighted average of (delta * drillCompletionRate / 100) across categories.
 * Equal weight per category. Result rounded to 2 decimal places.
 */
function computeTrainingEffectivenessScore(
  categories: SkillImprovementDelta[]
): number {
  if (categories.length === 0) return 0;

  const totalWeightedScore = categories.reduce((sum, cat) => {
    return sum + cat.delta * (cat.drillCompletionRate / 100);
  }, 0);

  const score = totalWeightedScore / categories.length;
  return Math.round(score * 100) / 100;
}


// ============================================================
// Student Trends (Attendance vs Skill Improvement)
// ============================================================

/**
 * Computes the Pearson correlation coefficient between two numeric arrays.
 * Returns undefined if fewer than 3 data points are provided or if
 * the denominator is zero (constant series).
 *
 * Formula: r = [n*Σ(xy) - Σx*Σy] / sqrt([n*Σ(x²) - (Σx)²] * [n*Σ(y²) - (Σy)²])
 *
 * Requirements: 9.3
 */
export function computePearsonCorrelation(
  x: number[],
  y: number[]
): number | undefined {
  const n = x.length;
  if (n < 3 || y.length < 3 || x.length !== y.length) {
    return undefined;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominatorLeft = n * sumX2 - sumX * sumX;
  const denominatorRight = n * sumY2 - sumY * sumY;
  const denominator = Math.sqrt(denominatorLeft * denominatorRight);

  // If denominator is zero, correlation is undefined (one or both series are constant)
  if (denominator === 0) {
    return undefined;
  }

  return numerator / denominator;
}

/**
 * Computes per-cycle attendance percentage and average skill score for a student,
 * then optionally computes the Pearson correlation coefficient if >= 3 cycles available.
 *
 * Logic:
 * 1. Find all distinct cycles for the student from skill_assessments.
 * 2. For each cycle, compute:
 *    - attendancePercentage: (PRESENT + LATE) / total attendance records in that cycle
 *    - avgSkillScore: average of all skill scores from the assessment for that cycle
 * 3. If >= 3 data points, compute Pearson correlation between attendance % and avg skill score.
 *
 * Requirements: 9.1, 9.3, 9.4
 */
export async function getStudentTrends(
  studentId: string,
  _centerId?: string
): Promise<StudentTrendReport> {
  // 1. Fetch all skill assessments for the student, grouped by cycle
  const assessmentsResult = await query(
    `SELECT cycle_key, scores, recorded_at
     FROM skill_assessments
     WHERE student_id = $1
     ORDER BY recorded_at ASC`,
    [studentId]
  );

  if (assessmentsResult.rows.length === 0) {
    return {
      studentId,
      dataPoints: [],
    };
  }

  // Get the student's batch_id for attendance queries
  const studentResult = await query(
    `SELECT batch_id FROM students WHERE id = $1`,
    [studentId]
  );

  if (studentResult.rows.length === 0) {
    return {
      studentId,
      dataPoints: [],
    };
  }

  const batchId = studentResult.rows[0].batch_id;

  // 2. Compute data points per cycle
  const dataPoints: TrendDataPoint[] = [];

  // Group assessments by cycle_key (use the latest assessment per cycle)
  const cycleAssessments = new Map<string, any>();
  for (const row of assessmentsResult.rows) {
    cycleAssessments.set(row.cycle_key, row);
  }

  for (const [cycleKey, assessment] of cycleAssessments) {
    // Compute average skill score from the scores JSONB
    const scores =
      typeof assessment.scores === 'string'
        ? JSON.parse(assessment.scores)
        : assessment.scores;

    const avgSkillScore = computeAverageSkillScore(scores);

    // Compute attendance percentage for this cycle
    const attendancePercentage = await computeCycleAttendancePercentage(
      studentId,
      batchId,
      cycleKey
    );

    dataPoints.push({
      cycleKey,
      attendancePercentage,
      avgSkillScore,
    });
  }

  // 3. Compute correlation coefficient if >= 3 data points
  let correlationCoefficient: number | undefined;
  if (dataPoints.length >= 3) {
    const attendanceValues = dataPoints.map((dp) => dp.attendancePercentage);
    const skillValues = dataPoints.map((dp) => dp.avgSkillScore);
    correlationCoefficient = computePearsonCorrelation(
      attendanceValues,
      skillValues
    );
  }

  return {
    studentId,
    dataPoints,
    correlationCoefficient,
  };
}

/**
 * Computes the average of all individual skill scores from a SkillScores object.
 * Categories: forehand, backhand, return, service, overhead, rally
 * Each category is an object { skillName: score (0-4) }
 */
function computeAverageSkillScore(scores: any): number {
  let totalScore = 0;
  let scoreCount = 0;

  for (const category of SKILL_CATEGORIES) {
    const categoryScores = scores[category];
    if (categoryScores && typeof categoryScores === 'object') {
      for (const skillName of Object.keys(categoryScores)) {
        const score = categoryScores[skillName];
        if (typeof score === 'number') {
          totalScore += score;
          scoreCount++;
        }
      }
    }
  }

  if (scoreCount === 0) return 0;
  return Math.round((totalScore / scoreCount) * 100) / 100;
}

/**
 * Computes attendance percentage for a student within a cycle's date boundaries.
 * Cycle keys are in format "Jan-Feb 2025" -> derives start/end months.
 * If no attendance records exist for the cycle, returns 0.
 */
async function computeCycleAttendancePercentage(
  studentId: string,
  batchId: string,
  cycleKey: string
): Promise<number> {
  const dateRange = parseCycleDateRange(cycleKey);
  if (!dateRange) {
    return 0;
  }

  const result = await query(
    `SELECT
       COUNT(*) AS total_sessions,
       COUNT(*) FILTER (WHERE status IN ('PRESENT', 'LATE')) AS attended
     FROM attendance_records
     WHERE student_id = $1
       AND batch_id = $2
       AND session_date >= $3
       AND session_date <= $4`,
    [studentId, batchId, dateRange.startDate, dateRange.endDate]
  );

  const row = result.rows[0];
  const totalSessions = parseInt(row.total_sessions, 10);
  const attended = parseInt(row.attended, 10);

  if (totalSessions === 0) return 0;
  return Math.round((attended / totalSessions) * 1000) / 10;
}

/**
 * Parses a cycle key (e.g., "Jan-Feb 2025") into start and end ISO dates.
 * Returns null if the format is unrecognized.
 */
export function parseCycleDateRange(
  cycleKey: string
): { startDate: string; endDate: string } | null {
  const monthMap: Record<string, number> = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const match = cycleKey.match(/^(\w{3})-(\w{3})\s+(\d{4})$/);
  if (!match) return null;

  const startMonthName = match[1];
  const endMonthName = match[2];
  const year = parseInt(match[3], 10);

  const startMonth = monthMap[startMonthName];
  const endMonth = monthMap[endMonthName];

  if (startMonth === undefined || endMonth === undefined) return null;

  // Start date: first day of start month
  const startDate = new Date(year, startMonth, 1);

  // End date: last day of end month
  const endDate = new Date(year, endMonth + 1, 0);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// ============================================================
// Training Patterns
// ============================================================

/**
 * Computes training pattern data for a batch within a date range:
 * 1. Category distributions: proportion of drills per skill category
 * 2. Attendance heatmap: attendance rate by day-of-week and week-number
 *
 * Category distribution logic:
 * - Aggregates drill categories from curriculum_plans for the batch
 *   within the specified date range (matching cycles that overlap the range)
 * - Computes proportion = (drillCount for category / totalDrills) * 100
 * - Proportions sum to 100%
 *
 * Requirements: 10.1, 10.2
 */
export async function getTrainingPatterns(
  batchId: string,
  startDate: string,
  endDate: string,
  _centerId?: string
): Promise<TrainingPatternReport> {
  // 1. Compute category distributions from curriculum plans
  const categoryDistributions = await computeCategoryDistributions(
    batchId,
    startDate,
    endDate
  );

  // 2. Compute attendance heatmap
  const attendanceHeatmap = await computeAttendanceHeatmap(
    batchId,
    startDate,
    endDate
  );

  return {
    categoryDistributions,
    attendanceHeatmap,
  };
}

/**
 * Aggregates drill categories from curriculum plans for the batch.
 * Looks at all curriculum plans whose cycles overlap the date range,
 * counts drills per category, and computes proportions summing to 100%.
 */
async function computeCategoryDistributions(
  batchId: string,
  startDate: string,
  endDate: string
): Promise<CategoryDistribution[]> {
  // Find curriculum plans for the batch that could overlap the date range
  const plansResult = await query(
    `SELECT weeks, cycle_key
     FROM curriculum_plans
     WHERE batch_id = $1 AND is_archived = false
     ORDER BY created_at DESC`,
    [batchId]
  );

  if (plansResult.rows.length === 0) {
    return [];
  }

  // Filter plans whose cycle overlaps the date range
  const startD = new Date(startDate);
  const endD = new Date(endDate);

  const categoryCounts: Record<string, number> = {};
  let totalDrills = 0;

  for (const planRow of plansResult.rows) {
    const cycleRange = parseCycleDateRange(planRow.cycle_key);
    if (!cycleRange) continue;

    // Check if cycle overlaps with the requested date range
    const cycleStart = new Date(cycleRange.startDate);
    const cycleEnd = new Date(cycleRange.endDate);

    if (cycleEnd < startD || cycleStart > endD) {
      continue; // No overlap
    }

    const weeks =
      typeof planRow.weeks === 'string'
        ? JSON.parse(planRow.weeks)
        : planRow.weeks;

    if (!Array.isArray(weeks)) continue;

    for (const week of weeks) {
      const drills = week.drills || [];
      for (const drill of drills) {
        const category = drill.category || 'uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        totalDrills++;
      }
    }
  }

  if (totalDrills === 0) {
    return [];
  }

  // Convert to CategoryDistribution array with proportions summing to 100%
  const distributions: CategoryDistribution[] = Object.entries(categoryCounts)
    .map(([category, drillCount]) => ({
      category,
      drillCount,
      proportion: Math.round((drillCount / totalDrills) * 10000) / 100,
    }))
    .sort((a, b) => b.drillCount - a.drillCount);

  // Adjust for rounding to ensure sum is exactly 100
  const sum = distributions.reduce((acc, d) => acc + d.proportion, 0);
  if (distributions.length > 0 && Math.abs(sum - 100) > 0.001) {
    // Adjust the largest category to correct rounding
    distributions[0].proportion =
      Math.round((distributions[0].proportion + (100 - sum)) * 100) / 100;
  }

  return distributions;
}

/**
 * Computes an attendance heatmap: attendance rate by day-of-week and week-number.
 * Groups attendance records by (dayOfWeek, weekNumber within the date range)
 * and computes the rate for each cell.
 */
async function computeAttendanceHeatmap(
  batchId: string,
  startDate: string,
  endDate: string
): Promise<
  Array<{ dayOfWeek: DayOfWeek; weekNumber: number; attendanceRate: number }>
> {
  // Fetch all attendance records for the batch within the date range
  const result = await query(
    `SELECT session_date, status
     FROM attendance_records
     WHERE batch_id = $1
       AND session_date >= $2
       AND session_date <= $3
     ORDER BY session_date ASC`,
    [batchId, startDate, endDate]
  );

  if (result.rows.length === 0) {
    return [];
  }

  // Group by (dayOfWeek, weekNumber) and compute attendance rate
  const rangeStart = new Date(startDate + 'T00:00:00');
  const heatmapData = new Map<string, { total: number; attended: number }>();

  for (const row of result.rows) {
    const sessionDate = new Date(
      row.session_date instanceof Date
        ? row.session_date.toISOString().split('T')[0] + 'T00:00:00'
        : row.session_date + 'T00:00:00'
    );

    const dayOfWeek = sessionDate.getDay() as DayOfWeek; // 0=Sun ... 6=Sat
    const daysSinceStart = Math.floor(
      (sessionDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const weekNumber = Math.floor(daysSinceStart / 7) + 1;

    const key = `${dayOfWeek}-${weekNumber}`;
    const current = heatmapData.get(key) || { total: 0, attended: 0 };
    current.total++;
    if (row.status === 'PRESENT' || row.status === 'LATE') {
      current.attended++;
    }
    heatmapData.set(key, current);
  }

  // Convert to array
  const heatmap: Array<{
    dayOfWeek: DayOfWeek;
    weekNumber: number;
    attendanceRate: number;
  }> = [];

  for (const [key, data] of heatmapData) {
    const [dayStr, weekStr] = key.split('-');
    const dayOfWeek = parseInt(dayStr, 10) as DayOfWeek;
    const weekNumber = parseInt(weekStr, 10);
    const attendanceRate =
      data.total > 0
        ? Math.round((data.attended / data.total) * 1000) / 10
        : 0;

    heatmap.push({ dayOfWeek, weekNumber, attendanceRate });
  }

  // Sort by weekNumber then dayOfWeek
  heatmap.sort((a, b) =>
    a.weekNumber !== b.weekNumber
      ? a.weekNumber - b.weekNumber
      : a.dayOfWeek - b.dayOfWeek
  );

  return heatmap;
}

// ============================================================
// Batch and Student Comparison
// ============================================================

/**
 * Computes the average skill improvement for a single student in a given cycle.
 *
 * Logic:
 * 1. Get all skill scores for the student in the cycle from weekly_skill_scores
 * 2. Find the earliest week (start) and latest week (end) scores per skill
 * 3. Compute delta per skill = endScore - startScore
 * 4. Return the mean of all skill deltas
 *
 * Returns null if fewer than 2 weeks of data exist.
 */
async function computeStudentSkillImprovement(
  studentId: string,
  cycleKey: string
): Promise<number | null> {
  const result = await query(
    `SELECT skill_id, week_number, score
     FROM weekly_skill_scores
     WHERE student_id = $1 AND cycle_key = $2
     ORDER BY skill_id, week_number`,
    [studentId, cycleKey]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Group scores by skill_id
  const skillScores: Map<string, Array<{ week: number; score: number }>> = new Map();
  for (const row of result.rows) {
    const entries = skillScores.get(row.skill_id) || [];
    entries.push({ week: row.week_number, score: row.score });
    skillScores.set(row.skill_id, entries);
  }

  // Compute delta per skill (latest week score - earliest week score)
  const deltas: number[] = [];
  for (const [, entries] of skillScores) {
    if (entries.length < 2) continue;
    // entries are already sorted by week_number from the SQL ORDER BY
    const startScore = entries[0].score;
    const endScore = entries[entries.length - 1].score;
    deltas.push(endScore - startScore);
  }

  if (deltas.length === 0) {
    return null;
  }

  // Return arithmetic mean of all skill deltas
  const sum = deltas.reduce((acc, d) => acc + d, 0);
  return Math.round((sum / deltas.length) * 100) / 100;
}

/**
 * Computes the attendance percentage for a student in a given batch.
 *
 * Uses all attendance records for the student in the batch:
 * attendancePercentage = (PRESENT + LATE) / total * 100
 */
async function computeStudentAttendanceForBatch(
  studentId: string,
  batchId: string
): Promise<number> {
  const result = await query(
    `SELECT
       COUNT(*) AS total_sessions,
       COUNT(*) FILTER (WHERE status IN ('PRESENT', 'LATE')) AS attended
     FROM attendance_records
     WHERE student_id = $1 AND batch_id = $2`,
    [studentId, batchId]
  );

  const totalSessions = parseInt(result.rows[0].total_sessions, 10);
  const attended = parseInt(result.rows[0].attended, 10);

  if (totalSessions === 0) return 0;

  return Math.round((attended / totalSessions) * 1000) / 10;
}

/**
 * Computes the drill completion rate for a student in a given cycle.
 *
 * Logic: count completed training logs / total weeks in the cycle * 100
 * A training log with is_completed = true counts as completing that week's drills.
 */
async function computeStudentDrillCompletion(
  studentId: string,
  cycleKey: string,
  totalWeeks: number
): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) AS completed_weeks
     FROM training_logs
     WHERE student_id = $1
       AND cycle_key = $2
       AND is_completed = true`,
    [studentId, cycleKey]
  );

  const completedWeeks = parseInt(result.rows[0].completed_weeks, 10);

  if (totalWeeks === 0) return 0;

  return Math.round((completedWeeks / totalWeeks) * 1000) / 10;
}

/**
 * Gets the total number of weeks defined in a curriculum plan for a batch/cycle.
 * Falls back to 8 (the standard cycle length) if no plan exists.
 */
async function getBatchCycleTotalWeeks(
  batchId: string,
  cycleKey: string
): Promise<number> {
  const planResult = await query(
    `SELECT weeks
     FROM curriculum_plans
     WHERE batch_id = $1 AND cycle_key = $2 AND is_archived = false AND student_id IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [batchId, cycleKey]
  );

  if (planResult.rows.length === 0) {
    return 8; // Default cycle length
  }

  const weeks =
    typeof planResult.rows[0].weeks === 'string'
      ? JSON.parse(planResult.rows[0].weeks)
      : planResult.rows[0].weeks;

  return Array.isArray(weeks) ? weeks.length : 8;
}

/**
 * Computes batch-level comparison metrics for all batches in a given cycle.
 *
 * For each batch:
 * - avgSkillImprovement: arithmetic mean of per-student skill improvement deltas
 * - avgAttendancePercentage: arithmetic mean of per-student attendance percentages
 * - avgDrillCompletionRate: arithmetic mean of per-student drill completion rates
 *
 * Batches with no students are included with zeroed metrics.
 *
 * Requirements: 8.1
 */
export async function getBatchComparison(
  cycleKey: string,
  centerId?: string
): Promise<BatchComparisonMetric[]> {
  // Get all active (non-archived) batches (with tenant scoping)
  let batchesResult;
  if (centerId) {
    batchesResult = await query(
      `SELECT id, name FROM batches WHERE is_archived = false AND center_id = $1 ORDER BY name ASC`,
      [centerId]
    );
  } else {
    batchesResult = await query(
      `SELECT id, name FROM batches WHERE is_archived = false ORDER BY name ASC`
    );
  }

  const metrics: BatchComparisonMetric[] = [];

  for (const batch of batchesResult.rows) {
    const batchId = batch.id;
    const batchName = batch.name;

    // Get all students in this batch
    const studentsResult = await query(
      `SELECT id FROM students WHERE batch_id = $1`,
      [batchId]
    );

    const studentIds: string[] = studentsResult.rows.map((s: any) => s.id);

    if (studentIds.length === 0) {
      metrics.push({
        batchId,
        batchName,
        avgSkillImprovement: 0,
        avgAttendancePercentage: 0,
        avgDrillCompletionRate: 0,
      });
      continue;
    }

    // Get total weeks for drill completion calculation
    const totalWeeks = await getBatchCycleTotalWeeks(batchId, cycleKey);

    // Compute per-student metrics
    const improvements: number[] = [];
    const attendances: number[] = [];
    const completions: number[] = [];

    for (const studentId of studentIds) {
      const improvement = await computeStudentSkillImprovement(studentId, cycleKey);
      if (improvement !== null) {
        improvements.push(improvement);
      }

      const attendance = await computeStudentAttendanceForBatch(studentId, batchId);
      attendances.push(attendance);

      const completion = await computeStudentDrillCompletion(studentId, cycleKey, totalWeeks);
      completions.push(completion);
    }

    // Compute arithmetic means
    const avgSkillImprovement =
      improvements.length > 0
        ? Math.round((improvements.reduce((a, b) => a + b, 0) / improvements.length) * 100) / 100
        : 0;

    const avgAttendancePercentage =
      attendances.length > 0
        ? Math.round((attendances.reduce((a, b) => a + b, 0) / attendances.length) * 10) / 10
        : 0;

    const avgDrillCompletionRate =
      completions.length > 0
        ? Math.round((completions.reduce((a, b) => a + b, 0) / completions.length) * 10) / 10
        : 0;

    metrics.push({
      batchId,
      batchName,
      avgSkillImprovement,
      avgAttendancePercentage,
      avgDrillCompletionRate,
    });
  }

  return metrics;
}

/**
 * Ranks students within a batch by skill improvement delta for a given cycle (descending).
 *
 * Returns each student with their improvement delta, attendance percentage,
 * and drill completion rate.
 *
 * Requirements: 8.3
 */
export async function getStudentComparison(
  batchId: string,
  cycleKey: string,
  _centerId?: string
): Promise<Array<{
  studentId: string;
  studentName: string;
  skillImprovementDelta: number;
  attendancePercentage: number;
  drillCompletionRate: number;
}>> {
  // Get all students in the batch
  const studentsResult = await query(
    `SELECT id, full_name FROM students WHERE batch_id = $1 ORDER BY full_name ASC`,
    [batchId]
  );

  if (studentsResult.rows.length === 0) {
    return [];
  }

  // Get total weeks for drill completion calculation
  const totalWeeks = await getBatchCycleTotalWeeks(batchId, cycleKey);

  // Compute metrics for each student
  const results: Array<{
    studentId: string;
    studentName: string;
    skillImprovementDelta: number;
    attendancePercentage: number;
    drillCompletionRate: number;
  }> = [];

  for (const student of studentsResult.rows) {
    const studentId = student.id;
    const studentName = student.full_name;

    const improvement = await computeStudentSkillImprovement(studentId, cycleKey);
    const attendance = await computeStudentAttendanceForBatch(studentId, batchId);
    const completion = await computeStudentDrillCompletion(studentId, cycleKey, totalWeeks);

    results.push({
      studentId,
      studentName,
      skillImprovementDelta: improvement ?? 0,
      attendancePercentage: attendance,
      drillCompletionRate: completion,
    });
  }

  // Sort by skill improvement delta descending
  results.sort((a, b) => b.skillImprovementDelta - a.skillImprovementDelta);

  return results;
}
