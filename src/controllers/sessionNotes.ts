import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantScope';
import { ValidationError, createOrUpdateNote, getNotes } from '../services/sessionNotes';
import { query } from '../config/database';
import { UserRole } from '../types';

/**
 * POST /api/session-notes
 * Create or update a coach note for a specific batch session date.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH
 *
 * Requirements: 17.8, 17.9
 */
export const createSessionNoteHandler = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { batchId, sessionDate, noteText } = req.body;

    const note = await createOrUpdateNote(
      batchId,
      sessionDate,
      noteText,
      req.user.id,
      req.tenantCenterId
    );

    res.status(200).json(note);
  } catch (error: any) {
    console.error('Create session note error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'An error occurred while creating session note',
    });
  }
};

/**
 * GET /api/session-notes/:batchId
 * Get coach notes for a batch with optional date range filtering.
 * Allowed roles: HEAD_COACH, ASSISTANT_COACH, STUDENT (all authenticated users)
 *
 * Requirements: 17.8, 17.9
 */
export const getSessionNotesHandler = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const batchId = req.params.batchId as string;
    const { startDate, endDate } = req.query;

    // STUDENT role: may only view notes for their own batch
    if (req.user.role === UserRole.STUDENT) {
      const studentResult = await query('SELECT batch_id FROM students WHERE id = $1', [req.user.id]);
      const ownBatchId = studentResult.rows[0]?.batch_id;
      if (!ownBatchId || ownBatchId !== batchId) {
        res.status(403).json({ error: 'You do not have permission to access notes for this batch' });
        return;
      }
    }

    const dateFilter: { startDate?: string; endDate?: string } = {};
    if (startDate) {
      dateFilter.startDate = startDate as string;
    }
    if (endDate) {
      dateFilter.endDate = endDate as string;
    }

    const notes = await getNotes(
      batchId,
      Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      req.tenantCenterId
    );

    res.status(200).json(notes);
  } catch (error: any) {
    console.error('Get session notes error:', error);

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({
      error: 'An error occurred while fetching session notes',
    });
  }
};
