import { query } from '../config/database';

// ============================================================
// Onboarding Checklist Service
// ============================================================

/**
 * Represents a single checklist item's state.
 */
export interface ChecklistItem {
  key: string;
  completed: boolean;
  completedAt: string | null; // ISO timestamp
}

/**
 * The six checklist item keys in order.
 */
const CHECKLIST_KEYS = [
  'add_coach',
  'add_students',
  'setup_curriculum',
  'create_batch_templates',
  'create_batches',
  'assign_students',
] as const;

/**
 * Returns the default set of six incomplete checklist items.
 */
function defaultItems(): ChecklistItem[] {
  return CHECKLIST_KEYS.map((key) => ({
    key,
    completed: false,
    completedAt: null,
  }));
}

/**
 * Runs the single optimized query with six COUNT subqueries and returns
 * the live completion state for all six checklist items.
 *
 * Each item is considered complete if its count >= 1.
 */
export async function evaluateChecklistItems(
  centerId: string,
  headCoachId: string
): Promise<ChecklistItem[]> {
  const result = await query(
    `SELECT
      (SELECT COUNT(*) FROM users WHERE center_id = $1 AND role IN ('ASSISTANT_COACH', 'HEAD_COACH') AND id != $2) AS coach_count,
      (SELECT COUNT(*) FROM students WHERE center_id = $1) AS student_count,
      (SELECT COUNT(*) FROM curriculum_plans WHERE center_id = $1) AS curriculum_count,
      (SELECT COUNT(*) FROM batch_time_templates WHERE center_id = $1) AS template_count,
      (SELECT COUNT(*) FROM batches WHERE center_id = $1) AS batch_count,
      (SELECT COUNT(*) FROM students WHERE center_id = $1 AND (assigned_coach_id IS NOT NULL OR batch_id IS NOT NULL)) AS assigned_count`,
    [centerId, headCoachId]
  );

  const row = result.rows[0];

  const counts: Record<string, number> = {
    add_coach: parseInt(row.coach_count, 10),
    add_students: parseInt(row.student_count, 10),
    setup_curriculum: parseInt(row.curriculum_count, 10),
    create_batch_templates: parseInt(row.template_count, 10),
    create_batches: parseInt(row.batch_count, 10),
    assign_students: parseInt(row.assigned_count, 10),
  };

  return CHECKLIST_KEYS.map((key) => ({
    key,
    completed: counts[key] >= 1,
    completedAt: null, // Live evaluation doesn't carry timestamps; reconciliation adds them
  }));
}

/**
 * Retrieves the existing checklist row for a center or returns default
 * empty state (six incomplete items) if no row exists.
 * Does not create a DB row on miss.
 */
export async function getOrCreateChecklist(centerId: string): Promise<{
  items: ChecklistItem[];
  dismissedAt: string | null;
}> {
  const result = await query(
    `SELECT items, dismissed_at FROM center_onboarding_checklists WHERE center_id = $1`,
    [centerId]
  );

  if (result.rows.length === 0) {
    return {
      items: defaultItems(),
      dismissedAt: null,
    };
  }

  const row = result.rows[0];
  const items: ChecklistItem[] = Array.isArray(row.items) ? row.items : defaultItems();

  return {
    items,
    dismissedAt: row.dismissed_at ? new Date(row.dismissed_at).toISOString() : null,
  };
}

/**
 * Pure function: merges live boolean state with stored timestamps.
 *
 * Rules:
 * - live=true + stored.completed=false → new timestamp (first detection)
 * - live=true + stored.completed=true → preserve existing timestamp
 * - live=false (regardless of stored) → completed=false, timestamp=null
 */
export function reconcileItems(
  stored: ChecklistItem[],
  live: ChecklistItem[]
): ChecklistItem[] {
  return live.map((liveItem) => {
    const storedItem = stored.find((s) => s.key === liveItem.key);

    if (liveItem.completed) {
      if (storedItem && storedItem.completed && storedItem.completedAt) {
        // Preserve existing first-detection timestamp
        return {
          key: liveItem.key,
          completed: true,
          completedAt: storedItem.completedAt,
        };
      }
      // First detection — assign new timestamp
      return {
        key: liveItem.key,
        completed: true,
        completedAt: new Date().toISOString(),
      };
    }

    // live=false → clear
    return {
      key: liveItem.key,
      completed: false,
      completedAt: null,
    };
  });
}

/**
 * Marks the checklist as dismissed for the given center.
 * Sets dismissed_at and updated_at to NOW().
 */
export async function dismissChecklist(centerId: string): Promise<string> {
  const result = await query(
    `UPDATE center_onboarding_checklists
     SET dismissed_at = NOW(), updated_at = NOW()
     WHERE center_id = $1
     RETURNING dismissed_at`,
    [centerId]
  );

  if (result.rows.length === 0) {
    // If no row exists, insert one with dismissed state
    const insertResult = await query(
      `INSERT INTO center_onboarding_checklists (center_id, items, dismissed_at, updated_at)
       VALUES ($1, $2::jsonb, NOW(), NOW())
       RETURNING dismissed_at`,
      [centerId, JSON.stringify(defaultItems())]
    );
    return new Date(insertResult.rows[0].dismissed_at).toISOString();
  }

  return new Date(result.rows[0].dismissed_at).toISOString();
}

/**
 * Returns true only if ALL six items are completed.
 */
export function computeAllComplete(items: ChecklistItem[]): boolean {
  return items.every((item) => item.completed);
}

/**
 * Returns the count of items where completed=true.
 */
export function computeProgressCount(items: ChecklistItem[]): number {
  return items.filter((item) => item.completed).length;
}
