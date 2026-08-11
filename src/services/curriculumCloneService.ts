import { query } from '../config/database';
import { getCurrentCycleKey } from '../utils/calculations';

/**
 * Auto-clone a batch-level curriculum plan to an individual student.
 *
 * Called when a student is added to (or moved into) a batch that has:
 * 1. A `curriculum_id` set (meaning a course is attached)
 * 2. A batch-level curriculum_plan for the current bi-monthly cycle
 *
 * If either condition is not met, the function returns silently (no-op).
 * If the student already has an individual plan for this cycle/batch, skip silently.
 *
 * @param studentId - The student being enrolled
 * @param batchId - The batch the student is being added to
 * @param centerId - Optional center_id for tenant scoping
 */
export async function autoCloneStudentPlan(
  studentId: string,
  batchId: string,
  centerId?: string | null
): Promise<void> {
  try {
    // 1. Check if batch has a curriculum_id (course attached)
    const batchResult = await query(
      `SELECT id, curriculum_id FROM batches WHERE id = $1`,
      [batchId]
    );

    if (batchResult.rows.length === 0) {
      return; // Batch not found — skip silently
    }

    const batch = batchResult.rows[0];

    if (!batch.curriculum_id) {
      return; // No course attached to this batch — skip silently
    }

    // 2. Get current cycle key
    const currentCycleKey = getCurrentCycleKey();

    // 3. Find the batch-level curriculum_plan for this batch + current cycle
    //    A batch-level plan has batch_id set and student_id IS NULL
    const batchPlanResult = await query(
      `SELECT id, weeks
       FROM curriculum_plans
       WHERE batch_id = $1 AND cycle_key = $2 AND student_id IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId, currentCycleKey]
    );

    if (batchPlanResult.rows.length === 0) {
      return; // No batch plan for current cycle — skip silently
    }

    const batchPlan = batchPlanResult.rows[0];

    // 4. Check if the student already has an individual plan for this cycle
    //    (to avoid duplicates if this is called multiple times)
    const existingStudentPlan = await query(
      `SELECT id FROM curriculum_plans
       WHERE student_id = $1 AND cycle_key = $2 AND source_batch_plan_id = $3
       LIMIT 1`,
      [studentId, currentCycleKey, batchPlan.id]
    );

    if (existingStudentPlan.rows.length > 0) {
      return; // Student already has a plan for this cycle — skip silently
    }

    // 5. Clone the batch plan to the individual student
    const weeksValue =
      typeof batchPlan.weeks === 'string'
        ? batchPlan.weeks
        : JSON.stringify(batchPlan.weeks);

    await query(
      `INSERT INTO curriculum_plans (
        cycle_key, student_id, source_batch_plan_id, weeks, is_archived, center_id
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [currentCycleKey, studentId, batchPlan.id, weeksValue, false, centerId || null]
    );
  } catch (error) {
    // Log but don't throw — auto-clone failure should not block student creation/update
    console.error(
      `[autoCloneStudentPlan] Failed to auto-clone plan for student=${studentId}, batch=${batchId}:`,
      error
    );
  }
}
