import { query } from '../config/database';
import {
  CalendarEntry,
  CurriculumWeekMapping,
  SessionSchedule,
  DayOfWeek,
} from '../types';
import { getSchedule, getWeekMappings } from './sessionSchedules';

// ============================================================================
// CalendarEngine
// ============================================================================
// Generates calendar entries from session schedules, mapping curriculum drills
// and focus areas to each session date. Enforces recurrence end boundaries and
// limits calendar generation to a maximum 3-month window.

const MAX_CALENDAR_WINDOW_DAYS = 92; // ~3 months

/**
 * Generate calendar entries for a batch within a date range.
 *
 * Logic:
 * 1. Fetch the session schedule for the batch.
 * 2. Validate the date range does not exceed 3 months.
 * 3. Iterate through each date in the range, checking if it matches
 *    a recurrence day and falls within the recurrence window.
 * 4. For each matching date, find the corresponding slot(s) and
 *    map curriculum week data (drills, focus area).
 * 5. Optionally enrich with attendance and coach note data.
 */
export async function generateCalendarEntries(
  batchId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEntry[]> {
  // Validate 3-month window limit
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }

  if (end < start) {
    throw new Error('endDate must be on or after startDate.');
  }

  const diffDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > MAX_CALENDAR_WINDOW_DAYS) {
    throw new Error(
      `Calendar generation limited to ${MAX_CALENDAR_WINDOW_DAYS} days (approximately 3 months). Requested range: ${diffDays} days.`
    );
  }

  // Fetch session schedule for the batch
  const schedule = await getSchedule(batchId);
  if (!schedule) {
    return [];
  }

  // Fetch batch name
  const batchName = await getBatchName(batchId);

  // Get week mappings for curriculum data
  const weekMappings = await getWeekMappings(batchId);

  // Fetch curriculum plan for the batch (latest non-archived)
  const curriculumWeeks = await getCurriculumWeeksForBatch(batchId);

  // Generate session dates from recurrence pattern
  const sessionDates = generateSessionDates(schedule, start, end);

  // Fetch attendance and notes for the date range in bulk for efficiency
  const attendanceMap = await getAttendanceMap(batchId, startDate, endDate);
  const notesMap = await getNotesMap(batchId, startDate, endDate);

  // Build calendar entries
  const entries: CalendarEntry[] = [];

  for (const sessionDate of sessionDates) {
    const dateStr = formatDate(sessionDate.date);
    const dayOfWeek = sessionDate.date.getDay() as DayOfWeek;

    // Find matching slot(s) for this day
    const matchingSlots = schedule.slots.filter(
      (slot) => slot.dayOfWeek === dayOfWeek
    );

    // Determine curriculum week for this date
    const weekInfo = findCurriculumWeek(sessionDate.date, weekMappings, schedule);

    // Get drills and focus area from curriculum plan
    let focusArea: string | undefined;
    let drills: string[] | undefined;

    if (weekInfo && curriculumWeeks) {
      const weekPlan = curriculumWeeks.find(
        (w) => w.weekNumber === weekInfo.weekNumber
      );
      if (weekPlan) {
        focusArea = weekPlan.focusArea;
        drills = weekPlan.drills.map((d) => d.name);
      }
    }

    for (const slot of matchingSlots) {
      entries.push({
        date: dateStr,
        batchId,
        batchName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        weekNumber: weekInfo?.weekNumber,
        focusArea,
        drills,
        attendanceRecorded: attendanceMap.has(dateStr),
        coachNote: notesMap.get(dateStr),
      });
    }
  }

  return entries;
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Generate all session dates within the given range that match
 * the recurrence pattern and respect end boundaries.
 */
function generateSessionDates(
  schedule: SessionSchedule,
  start: Date,
  end: Date
): Array<{ date: Date; occurrenceIndex: number }> {
  const { recurrence, cycleStartDate } = schedule;
  const results: Array<{ date: Date; occurrenceIndex: number }> = [];

  // Determine the cycle start for computing repeat intervals
  const cycleStart = cycleStartDate ? parseDate(cycleStartDate) : start;

  // Track total occurrences for after_count enforcement
  let occurrenceCount = 0;

  // Iterate day by day through the range
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const dayOfWeek = current.getDay() as DayOfWeek;

    // Check if this day is in the recurrence's repeatDays
    if (recurrence.repeatDays.includes(dayOfWeek)) {
      // Check repeat interval (every N weeks)
      if (isInRepeatInterval(current, cycleStart, recurrence.repeatEvery)) {
        // Check end boundary: on_date
        if (recurrence.endType === 'on_date' && recurrence.endDate) {
          const endBoundary = parseDate(recurrence.endDate);
          if (current > endBoundary) {
            // Past the end date - stop generating
            break;
          }
        }

        // Check end boundary: after_count
        if (recurrence.endType === 'after_count' && recurrence.occurrenceCount) {
          if (occurrenceCount >= recurrence.occurrenceCount) {
            // Reached the max occurrence count - stop
            break;
          }
        }

        occurrenceCount++;
        results.push({ date: new Date(current), occurrenceIndex: occurrenceCount });
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return results;
}

/**
 * Determine if a given date falls within the correct repeat interval.
 * For repeatEvery=1, every week matches.
 * For repeatEvery=2, only every other week from the cycle start matches.
 */
function isInRepeatInterval(
  date: Date,
  cycleStart: Date,
  repeatEvery: number
): boolean {
  if (repeatEvery <= 1) {
    return true;
  }

  // Calculate the number of weeks since cycle start
  const diffMs = date.getTime() - cycleStart.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7);

  // Check if this week is in the correct interval
  return weekNumber % repeatEvery === 0;
}

/**
 * Find which curriculum week a given date falls into.
 * First checks explicit week mappings, then computes from cycle start.
 */
function findCurriculumWeek(
  date: Date,
  weekMappings: CurriculumWeekMapping[],
  schedule: SessionSchedule
): { weekNumber: number } | null {
  const dateStr = formatDate(date);

  // Check explicit week mappings first
  for (const mapping of weekMappings) {
    if (dateStr >= mapping.startDate && dateStr <= mapping.endDate) {
      return { weekNumber: mapping.weekNumber };
    }
  }

  // Fall back to computing from cycle start date
  if (!schedule.cycleStartDate) {
    return null;
  }

  const cycleStart = parseDate(schedule.cycleStartDate);
  const diffMs = date.getTime() - cycleStart.getTime();
  if (diffMs < 0) {
    return null; // Date is before cycle start
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weekIntervalDays = schedule.recurrence.repeatEvery * 7;
  const weekNumber = Math.floor(diffDays / weekIntervalDays) + 1;

  // Curriculum plans max out at 8 weeks
  if (weekNumber < 1 || weekNumber > 8) {
    return null;
  }

  return { weekNumber };
}

/**
 * Fetch the batch name from the database.
 */
async function getBatchName(batchId: string): Promise<string> {
  const result = await query(
    `SELECT name FROM batches WHERE id = $1`,
    [batchId]
  );

  if (result.rows.length === 0) {
    return 'Unknown Batch';
  }

  return result.rows[0].name;
}

/**
 * Fetch the curriculum plan weeks for a batch.
 * Returns the most recent non-archived batch-level plan.
 */
async function getCurriculumWeeksForBatch(
  batchId: string
): Promise<Array<{ weekNumber: number; focusArea: string; drills: Array<{ name: string; category: string }> }> | null> {
  const result = await query(
    `SELECT weeks FROM curriculum_plans
     WHERE batch_id = $1 AND is_archived = false
     ORDER BY created_at DESC
     LIMIT 1`,
    [batchId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const weeks = typeof result.rows[0].weeks === 'string'
    ? JSON.parse(result.rows[0].weeks)
    : result.rows[0].weeks;

  return weeks.map((w: any) => ({
    weekNumber: w.weekNumber,
    focusArea: w.focusArea,
    drills: (w.drills || []).map((d: any) => ({
      name: d.name,
      category: d.category,
    })),
  }));
}

/**
 * Get a map of dates that have attendance recorded for this batch.
 */
async function getAttendanceMap(
  batchId: string,
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const result = await query(
    `SELECT DISTINCT session_date FROM attendance_records
     WHERE batch_id = $1 AND session_date >= $2 AND session_date <= $3`,
    [batchId, startDate, endDate]
  );

  const dateSet = new Set<string>();
  for (const row of result.rows) {
    dateSet.add(formatDate(new Date(row.session_date)));
  }
  return dateSet;
}

/**
 * Get a map of dates to coach notes for this batch.
 */
async function getNotesMap(
  batchId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, string>> {
  const result = await query(
    `SELECT session_date, note_text FROM session_notes
     WHERE batch_id = $1 AND session_date >= $2 AND session_date <= $3`,
    [batchId, startDate, endDate]
  );

  const notesMap = new Map<string, string>();
  for (const row of result.rows) {
    notesMap.set(formatDate(new Date(row.session_date)), row.note_text);
  }
  return notesMap;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a date string (YYYY-MM-DD) into a Date object at midnight UTC-safe local time.
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format a Date to ISO date string (YYYY-MM-DD).
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
