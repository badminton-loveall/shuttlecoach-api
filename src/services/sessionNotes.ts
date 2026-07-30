import { query } from '../config/database';
import { SessionNote } from '../types';

/**
 * SessionNotesService
 *
 * Handles creation, update (upsert), and retrieval of coach notes
 * for specific batch session dates.
 *
 * Requirements: 17.7, 17.8, 17.9
 */

interface DateFilter {
  startDate?: string;
  endDate?: string;
}

/**
 * Create or update a coach note for a specific batch and session date.
 * Uses ON CONFLICT(batch_id, session_date) to implement upsert semantics -
 * only one note can exist per batch per date.
 */
export async function createOrUpdateNote(
  batchId: string,
  date: string,
  noteText: string,
  createdBy: string
): Promise<SessionNote> {
  // Validate required fields
  if (!batchId) {
    throw new ValidationError('batchId is required');
  }
  if (!date) {
    throw new ValidationError('date is required');
  }
  if (!noteText || noteText.trim().length === 0) {
    throw new ValidationError('noteText is required and cannot be empty');
  }
  if (!createdBy) {
    throw new ValidationError('createdBy is required');
  }

  const result = await query(
    `INSERT INTO session_notes (batch_id, session_date, note_text, created_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ON CONSTRAINT uq_session_notes_batch_date
     DO UPDATE SET
       note_text = EXCLUDED.note_text,
       created_by = EXCLUDED.created_by,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, batch_id, session_date, note_text, created_by, created_at, updated_at`,
    [batchId, date, noteText.trim(), createdBy]
  );

  return mapRowToSessionNote(result.rows[0]);
}

/**
 * Retrieve coach notes for a batch with optional date range filtering.
 * Supports filtering by startDate, endDate, or both.
 */
export async function getNotes(
  batchId: string,
  dateFilter?: DateFilter
): Promise<SessionNote[]> {
  if (!batchId) {
    throw new ValidationError('batchId is required');
  }

  const conditions: string[] = ['batch_id = $1'];
  const params: any[] = [batchId];
  let paramIndex = 2;

  if (dateFilter?.startDate) {
    conditions.push(`session_date >= $${paramIndex}`);
    params.push(dateFilter.startDate);
    paramIndex++;
  }

  if (dateFilter?.endDate) {
    conditions.push(`session_date <= $${paramIndex}`);
    params.push(dateFilter.endDate);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT id, batch_id, session_date, note_text, created_by, created_at, updated_at
     FROM session_notes
     WHERE ${whereClause}
     ORDER BY session_date DESC`,
    params
  );

  return result.rows.map(mapRowToSessionNote);
}

/**
 * Map a database row (snake_case) to a SessionNote object (camelCase).
 */
function mapRowToSessionNote(row: any): SessionNote {
  return {
    id: row.id,
    batchId: row.batch_id,
    sessionDate: row.session_date instanceof Date
      ? row.session_date.toISOString().split('T')[0]
      : String(row.session_date),
    noteText: row.note_text,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Custom validation error for service-layer input validation.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
