import { query } from '../config/database';

/**
 * Template-based session calendar generation.
 *
 * Generates session entries on-the-fly from a batch's assigned template slots.
 * No materialized session rows — computed dynamically from template + date range.
 */

export interface TemplateCalendarSession {
  date: string;        // YYYY-MM-DD
  day_of_week: string; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  start_time: string;  // HH:MM
  duration_hours: number;
}

/**
 * Map day_of_week strings ('Mon', 'Tue', ...) to JS Date.getDay() numbers.
 * JS: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
 */
const DAY_OF_WEEK_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Generate template-based calendar sessions for a batch.
 *
 * @param batchId - The batch to generate sessions for
 * @param startDate - Start of date range (YYYY-MM-DD), defaults to 1st of current month
 * @param endDate - End of date range (YYYY-MM-DD), defaults to last day of current month
 * @param centerId - Tenant center ID for scoping
 * @returns Array of sessions sorted by date then start_time, or empty if no template assigned
 */
export async function generateTemplateCalendarSessions(
  batchId: string,
  startDate?: string,
  endDate?: string,
  centerId?: string
): Promise<TemplateCalendarSession[]> {
  // 1. Look up the batch's template_id
  let batchResult;
  if (centerId) {
    batchResult = await query(
      `SELECT template_id FROM batches WHERE id = $1 AND center_id = $2`,
      [batchId, centerId]
    );
  } else {
    batchResult = await query(
      `SELECT template_id FROM batches WHERE id = $1`,
      [batchId]
    );
  }

  if (batchResult.rows.length === 0) {
    return [];
  }

  const templateId = batchResult.rows[0].template_id;

  // 2. If no template assigned, return empty
  if (!templateId) {
    return [];
  }

  // 3. Load session_slots for that template
  const slotsResult = await query(
    `SELECT day_of_week, start_time, duration_hours
     FROM session_slots
     WHERE template_id = $1`,
    [templateId]
  );

  if (slotsResult.rows.length === 0) {
    return [];
  }

  // 4. Determine date range (default: current month)
  const { start, end } = resolveDateRange(startDate, endDate);

  // 5. For each slot, find all dates in [start, end] matching the slot's day_of_week
  const sessions: TemplateCalendarSession[] = [];

  for (const slot of slotsResult.rows) {
    const dayName: string = slot.day_of_week;
    const targetDayNum = DAY_OF_WEEK_MAP[dayName];

    if (targetDayNum === undefined) {
      continue; // skip invalid day names
    }

    // Format start_time: PostgreSQL TIME may return "HH:MM:SS", we want "HH:MM"
    const startTimeFormatted = formatTime(slot.start_time);

    // Find all matching dates
    const matchingDates = findDatesForDayOfWeek(start, end, targetDayNum);

    for (const date of matchingDates) {
      sessions.push({
        date: formatDate(date),
        day_of_week: dayName,
        start_time: startTimeFormatted,
        duration_hours: slot.duration_hours,
      });
    }
  }

  // 6. Sort by date, then start_time
  sessions.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.start_time.localeCompare(b.start_time);
  });

  return sessions;
}

/**
 * Resolve start/end date range, defaulting to current month if not provided.
 */
function resolveDateRange(
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } {
  const now = new Date();

  let start: Date;
  if (startDate) {
    start = parseDate(startDate);
  } else {
    // First day of current month
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  let end: Date;
  if (endDate) {
    end = parseDate(endDate);
  } else {
    // Last day of current month
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return { start, end };
}

/**
 * Find all dates in [start, end] that fall on the given JS day number.
 */
function findDatesForDayOfWeek(
  start: Date,
  end: Date,
  targetDay: number
): Date[] {
  const dates: Date[] = [];

  // Find the first occurrence of targetDay on or after start
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const currentDay = current.getDay();
  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7;
  }
  current.setDate(current.getDate() + daysUntilTarget);

  // Iterate weekly until we pass end
  const endTime = new Date(end);
  endTime.setHours(23, 59, 59, 999);

  while (current <= endTime) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  return dates;
}

/**
 * Parse a date string (YYYY-MM-DD) into a Date at midnight local.
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format a Date to YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a PostgreSQL TIME value to HH:MM.
 * Handles both "HH:MM" and "HH:MM:SS" formats.
 */
function formatTime(timeValue: string): string {
  if (!timeValue) return '00:00';
  const str = String(timeValue);
  // Take only HH:MM portion
  return str.substring(0, 5);
}
