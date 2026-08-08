import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';
import { validateNoOverlap } from '../utils/slotOverlapValidator';

/**
 * POST /api/batch-time-templates
 * Create a new template with session slots
 * Requires: HEAD_COACH role
 */
export const createTemplate = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, slots } = req.body;
    const centerId = req.tenantCenterId;

    // Check for overlapping slots
    const overlapResult = validateNoOverlap(slots);
    if (!overlapResult.valid) {
      res.status(400).json({
        error: `Session slots overlap: indices ${overlapResult.conflicts.map(c => `[${c[0]}, ${c[1]}]`).join(', ')}`,
      });
      return;
    }

    // Insert template
    const templateResult = await query(
      `INSERT INTO batch_time_templates (name, center_id)
       VALUES ($1, $2)
       RETURNING id, name, center_id, is_archived, created_at, updated_at`,
      [name, centerId]
    );

    const template = templateResult.rows[0];

    // Insert session slots
    if (slots && slots.length > 0) {
      const slotValues: any[] = [];
      const slotPlaceholders: string[] = [];
      slots.forEach((slot: any, index: number) => {
        const offset = index * 3;
        slotPlaceholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        slotValues.push(template.id, slot.day_of_week, slot.start_time, slot.duration_hours);
      });

      // Build batch insert for slots
      for (const slot of slots) {
        await query(
          `INSERT INTO session_slots (template_id, day_of_week, start_time, duration_hours)
           VALUES ($1, $2, $3, $4)`,
          [template.id, slot.day_of_week, slot.start_time, slot.duration_hours]
        );
      }
    }

    // Fetch the complete template with slots
    const slotsResult = await query(
      `SELECT id, day_of_week, start_time, duration_hours FROM session_slots WHERE template_id = $1`,
      [template.id]
    );

    res.status(201).json({
      ...template,
      slots: slotsResult.rows,
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'An error occurred while creating template' });
  }
};

/**
 * GET /api/batch-time-templates
 * List all non-archived templates for the current center
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const listTemplates = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;

    const result = await query(
      `SELECT t.id, t.name, t.is_archived, t.created_at, t.updated_at,
              COUNT(s.id)::int AS slot_count
       FROM batch_time_templates t
       LEFT JOIN session_slots s ON s.template_id = t.id
       WHERE t.center_id = $1 AND t.is_archived = false
       GROUP BY t.id
       ORDER BY t.name`,
      [centerId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ error: 'An error occurred while listing templates' });
  }
};

/**
 * GET /api/batch-time-templates/:id
 * Get a single template with its session slots
 * Requires: HEAD_COACH or ASSISTANT_COACH role
 */
export const getTemplate = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const centerId = req.tenantCenterId;

    const templateResult = await query(
      `SELECT id, name, center_id, is_archived, created_at, updated_at
       FROM batch_time_templates
       WHERE id = $1 AND center_id = $2`,
      [id, centerId]
    );

    if (templateResult.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const template = templateResult.rows[0];

    const slotsResult = await query(
      `SELECT id, day_of_week, start_time, duration_hours
       FROM session_slots
       WHERE template_id = $1`,
      [template.id]
    );

    res.status(200).json({
      ...template,
      slots: slotsResult.rows,
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'An error occurred while fetching template' });
  }
};

/**
 * PATCH /api/batch-time-templates/:id
 * Update a template (name and/or slots)
 * Requires: HEAD_COACH role
 */
export const updateTemplate = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, slots } = req.body;
    const centerId = req.tenantCenterId;

    // Verify template exists and belongs to center
    const existingResult = await query(
      `SELECT id, is_archived FROM batch_time_templates WHERE id = $1 AND center_id = $2`,
      [id, centerId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    if (existingResult.rows[0].is_archived) {
      res.status(400).json({ error: 'Cannot update an archived template' });
      return;
    }

    // Check for overlapping slots if slots are provided
    if (slots) {
      const overlapResult = validateNoOverlap(slots);
      if (!overlapResult.valid) {
        res.status(400).json({
          error: `Session slots overlap: indices ${overlapResult.conflicts.map((c: [number, number]) => `[${c[0]}, ${c[1]}]`).join(', ')}`,
        });
        return;
      }
    }

    // Update name if provided
    if (name) {
      await query(
        `UPDATE batch_time_templates SET name = $1, updated_at = NOW() WHERE id = $2`,
        [name, id]
      );
    }

    // Replace slots if provided
    if (slots) {
      // Delete existing slots
      await query(`DELETE FROM session_slots WHERE template_id = $1`, [id]);

      // Insert new slots
      for (const slot of slots) {
        await query(
          `INSERT INTO session_slots (template_id, day_of_week, start_time, duration_hours)
           VALUES ($1, $2, $3, $4)`,
          [id, slot.day_of_week, slot.start_time, slot.duration_hours]
        );
      }

      // Update timestamp even if only slots changed
      await query(
        `UPDATE batch_time_templates SET updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    // Fetch updated template with slots
    const templateResult = await query(
      `SELECT id, name, center_id, is_archived, created_at, updated_at
       FROM batch_time_templates WHERE id = $1`,
      [id]
    );

    const slotsResult = await query(
      `SELECT id, day_of_week, start_time, duration_hours
       FROM session_slots WHERE template_id = $1`,
      [id]
    );

    res.status(200).json({
      ...templateResult.rows[0],
      slots: slotsResult.rows,
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'An error occurred while updating template' });
  }
};

/**
 * DELETE /api/batch-time-templates/:id
 * Archive a template (soft-delete)
 * Blocked if template is assigned to any non-archived batch
 * Requires: HEAD_COACH role
 */
export const archiveTemplate = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const centerId = req.tenantCenterId;

    // Verify template exists and belongs to center
    const existingResult = await query(
      `SELECT id, is_archived FROM batch_time_templates WHERE id = $1 AND center_id = $2`,
      [id, centerId]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    if (existingResult.rows[0].is_archived) {
      res.status(400).json({ error: 'Template is already archived' });
      return;
    }

    // Check if template is in use by any non-archived batch
    const inUseResult = await query(
      `SELECT name FROM batches WHERE template_id = $1 AND is_archived = false`,
      [id]
    );

    if (inUseResult.rows.length > 0) {
      const batchNames = inUseResult.rows.map((r: any) => r.name).join(', ');
      res.status(409).json({
        error: `Cannot delete template. Used by batches: ${batchNames}`,
      });
      return;
    }

    // Archive the template
    await query(
      `UPDATE batch_time_templates SET is_archived = true, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    res.status(200).json({ message: 'Template archived successfully' });
  } catch (error) {
    console.error('Archive template error:', error);
    res.status(500).json({ error: 'An error occurred while archiving template' });
  }
};
