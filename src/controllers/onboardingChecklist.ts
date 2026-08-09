import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import {
  evaluateChecklistItems,
  getOrCreateChecklist,
  reconcileItems,
  dismissChecklist as dismissChecklistService,
  computeAllComplete,
  ChecklistItem,
} from '../services/onboardingChecklistService';

/**
 * Labels for each checklist item key.
 */
const ITEM_LABELS: Record<string, string> = {
  add_coach: 'Add a coach',
  add_students: 'Add students',
  setup_curriculum: 'Set up curriculum',
  create_batch_templates: 'Create batch templates',
  create_batches: 'Create batches',
  assign_students: 'Assign students to coaches/batches',
};

/**
 * Navigation links for each checklist item key.
 */
const ITEM_LINKS: Record<string, string> = {
  add_coach: '/coaches',
  add_students: '/students',
  setup_curriculum: '/curriculum',
  create_batch_templates: '/batches',
  create_batches: '/batches',
  assign_students: '/students',
};

/**
 * GET /api/onboarding-checklist
 *
 * Returns the current onboarding checklist status for the authenticated
 * HEAD_COACH's center. Evaluates live completion conditions and reconciles
 * with stored timestamps.
 */
export const getChecklistStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const centerId = req.user.centerId;
    const headCoachId = req.user.id;

    if (!centerId) {
      res.status(400).json({ error: 'No center associated with this user' });
      return;
    }

    // Evaluate live completion state from real data
    const liveItems = await evaluateChecklistItems(centerId, headCoachId);

    // Get stored checklist (or defaults if no row exists)
    const stored = await getOrCreateChecklist(centerId);

    // Reconcile live state with stored timestamps
    const reconciledItems = reconcileItems(stored.items, liveItems);

    // Persist reconciled items back to DB
    await upsertChecklistItems(centerId, reconciledItems);

    // Build response
    const allComplete = computeAllComplete(reconciledItems);

    const items = reconciledItems.map((item) => ({
      key: item.key,
      label: ITEM_LABELS[item.key] || item.key,
      completed: item.completed,
      completedAt: item.completedAt,
      link: ITEM_LINKS[item.key] || '/',
    }));

    res.status(200).json({
      items,
      allComplete,
      dismissedAt: stored.dismissedAt,
    });
  } catch (error) {
    console.error('Get checklist status error:', error);
    res.status(500).json({ error: 'An error occurred while fetching checklist status' });
  }
};

/**
 * POST /api/onboarding-checklist/dismiss
 *
 * Marks the onboarding checklist as dismissed for the authenticated
 * HEAD_COACH's center.
 */
export const dismissChecklist = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const centerId = req.user.centerId;

    if (!centerId) {
      res.status(400).json({ error: 'No center associated with this user' });
      return;
    }

    const dismissedAt = await dismissChecklistService(centerId);

    res.status(200).json({
      success: true,
      dismissedAt,
    });
  } catch (error) {
    console.error('Dismiss checklist error:', error);
    res.status(500).json({ error: 'An error occurred while dismissing checklist' });
  }
};

/**
 * Upserts the reconciled checklist items into the database.
 * If a row exists, UPDATE. If not, INSERT.
 */
async function upsertChecklistItems(
  centerId: string,
  items: ChecklistItem[]
): Promise<void> {
  const itemsJson = JSON.stringify(items);

  // Try UPDATE first
  const updateResult = await query(
    `UPDATE center_onboarding_checklists
     SET items = $1::jsonb, updated_at = NOW()
     WHERE center_id = $2`,
    [itemsJson, centerId]
  );

  // If no row was updated, INSERT a new one
  if (updateResult.rowCount === 0) {
    await query(
      `INSERT INTO center_onboarding_checklists (center_id, items, updated_at)
       VALUES ($1, $2::jsonb, NOW())`,
      [centerId, itemsJson]
    );
  }
}
