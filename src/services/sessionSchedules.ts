import { query } from '../config/database';
import {
  SessionSchedule,
  SessionSlot,
  RecurrencePattern,
  CurriculumWeekMapping,
} from '../types';

// ============================================================================
// SessionScheduleService
// ============================================================================
// Manages structured session schedules for batches including JSONB slot/recurrence
// storage, curriculum week mapping computation, and mapping recomputation on updates.

/**
 * Create or update the session schedule for a batch.
 * Uses ON CONFLICT(batch_id) to upsert since only one schedule per batch exists.
 */
export async function createOrUpdateSchedule(
  batchId: string,
  slots: SessionSlot[],
  recurrence: RecurrencePattern,
  cycleStartDate?: string,
  centerId?: string
): Promise<SessionSchedule> {
  const result = await query(
    `INSERT INTO session_schedules (batch_id, slots, recurrence, cycle_start_date, center_id)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)
     ON CONFLICT ON CONSTRAINT uq_session_schedules_batch
     DO UPDATE SET
       slots = EXCLUDED.slots,
       recurrence = EXCLUDED.recurrence,
       cycle_start_date = EXCLUDED.cycle_start_date
     RETURNING id, batch_id, slots, recurrence, cycle_start_date, created_at, updated_at`,
    [batchId, JSON.stringify(slots), JSON.stringify(recurrence), cycleStartDate || null, centerId || null]
  );

  return mapScheduleRow(result.rows[0]);
}

/**
 * Get the session schedule for a batch.
 * Returns null if no schedule exists.
 */
export async function getSchedule(batchId: string): Promise<SessionSchedule | null> {
  const result = await query(
    `SELECT id, batch_id, slots, recurrence, cycle_start_date, created_at, updated_at
     FROM session_schedules
     WHERE batch_id = $1`,
    [batchId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapScheduleRow(result.rows[0]);
}


/**
 * Compute and store curriculum week mappings for a batch and cycle.
 *
 * Logic:
 * - A "session week" is defined by the recurrence pattern's repeat interval.
 *   For repeatEvery=1, each calendar week (starting from cycle start) maps to one curriculum week.
 *   For repeatEvery=2, every 2 calendar weeks maps to one curriculum week.
 * - Week N starts at cycleStartDate + (N-1) * repeatEvery * 7 days.
 * - Week N ends at cycleStartDate + N * repeatEvery * 7 - 1 days.
 * - Generates up to 8 weeks (curriculum plan max).
 * - Respects recurrence end boundaries (on_date or after_count).
 */
export async function computeCurriculumWeekMapping(
  batchId: string,
  cycleKey: string
): Promise<CurriculumWeekMapping[]> {
  const schedule = await getSchedule(batchId);
  if (!schedule || !schedule.cycleStartDate) {
    return [];
  }

  const { recurrence, cycleStartDate } = schedule;
  const cycleStart = new Date(cycleStartDate);
  const weekIntervalDays = recurrence.repeatEvery * 7;
  const maxWeeks = 8;

  const mappings: CurriculumWeekMapping[] = [];

  for (let week = 1; week <= maxWeeks; week++) {
    const weekStartOffset = (week - 1) * weekIntervalDays;
    const weekEndOffset = week * weekIntervalDays - 1;

    const startDate = addDays(cycleStart, weekStartOffset);
    const endDate = addDays(cycleStart, weekEndOffset);

    // Respect end boundary: on_date
    if (recurrence.endType === 'on_date' && recurrence.endDate) {
      const endBoundary = new Date(recurrence.endDate);
      if (startDate > endBoundary) {
        break;
      }
    }

    // Respect end boundary: after_count
    if (recurrence.endType === 'after_count' && recurrence.occurrenceCount) {
      const sessionsPerWeek = recurrence.repeatDays.length;
      const totalSessionsUpToWeek = week * recurrence.repeatEvery * sessionsPerWeek;
      if (totalSessionsUpToWeek > recurrence.occurrenceCount) {
        // Check if at least some sessions fall within this week
        const totalSessionsBeforeWeek = (week - 1) * recurrence.repeatEvery * sessionsPerWeek;
        if (totalSessionsBeforeWeek >= recurrence.occurrenceCount) {
          break;
        }
      }
    }

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Upsert the mapping
    const result = await query(
      `INSERT INTO curriculum_week_mappings (batch_id, cycle_key, week_number, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT uq_curriculum_week_mapping
       DO UPDATE SET
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date
       RETURNING id, batch_id, cycle_key, week_number, start_date, end_date`,
      [batchId, cycleKey, week, startDateStr, endDateStr]
    );

    mappings.push(mapWeekMappingRow(result.rows[0]));
  }

  return mappings;
}

/**
 * Recompute curriculum week mappings for future dates when a schedule changes.
 * Only updates mappings whose start_date is in the future (preserves historical mappings).
 */
export async function recomputeMappingsOnUpdate(batchId: string): Promise<void> {
  const schedule = await getSchedule(batchId);
  if (!schedule || !schedule.cycleStartDate) {
    return;
  }

  // Get all existing cycle keys for this batch
  const existingMappings = await query(
    `SELECT DISTINCT cycle_key FROM curriculum_week_mappings WHERE batch_id = $1`,
    [batchId]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  for (const row of existingMappings.rows) {
    const cycleKey = row.cycle_key;

    // Delete future mappings for this cycle (they will be recomputed)
    await query(
      `DELETE FROM curriculum_week_mappings
       WHERE batch_id = $1 AND cycle_key = $2 AND start_date > $3`,
      [batchId, cycleKey, todayStr]
    );

    // Recompute all weeks for this cycle; only future ones were deleted
    // so upsert will preserve past ones and insert new future ones
    await computeCurriculumWeekMapping(batchId, cycleKey);
  }
}

/**
 * Get all curriculum week mappings for a batch and optional cycle key.
 */
export async function getWeekMappings(
  batchId: string,
  cycleKey?: string
): Promise<CurriculumWeekMapping[]> {
  let sql = `SELECT id, batch_id, cycle_key, week_number, start_date, end_date
             FROM curriculum_week_mappings
             WHERE batch_id = $1`;
  const params: any[] = [batchId];

  if (cycleKey) {
    sql += ` AND cycle_key = $2`;
    params.push(cycleKey);
  }

  sql += ` ORDER BY week_number ASC`;

  const result = await query(sql, params);
  return result.rows.map(mapWeekMappingRow);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map a database row to a SessionSchedule object.
 */
function mapScheduleRow(row: any): SessionSchedule {
  return {
    id: row.id,
    batchId: row.batch_id,
    slots: row.slots as SessionSlot[],
    recurrence: row.recurrence as RecurrencePattern,
    cycleStartDate: row.cycle_start_date
      ? formatDate(new Date(row.cycle_start_date))
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map a database row to a CurriculumWeekMapping object.
 */
function mapWeekMappingRow(row: any): CurriculumWeekMapping {
  return {
    id: row.id,
    batchId: row.batch_id,
    cycleKey: row.cycle_key,
    weekNumber: row.week_number,
    startDate: formatDate(new Date(row.start_date)),
    endDate: formatDate(new Date(row.end_date)),
  };
}

/**
 * Add days to a date, returning a new Date object.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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
