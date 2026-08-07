import { Response } from 'express';
import { query } from '../../config/database';
import { AuthRequest } from '../../middleware/auth';

/**
 * POST /api/admin/centers/:id/activate
 * Toggle center active status and optionally update subscription fields.
 * Requirements: 6.1, 6.3
 */
export const toggleCenterActivation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive, planType, subscriptionExpiresAt } = req.body;

    // Validate required field
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive (boolean) is required' });
      return;
    }

    // Check center exists
    const existing = await query(
      'SELECT id FROM centers WHERE id = $1',
      [id]
    );

    if (existing.rowCount === 0) {
      res.status(404).json({ error: 'Center not found' });
      return;
    }

    // Build dynamic SET clause — is_active is always updated;
    // planType and subscriptionExpiresAt are updated only when provided.
    const setClauses: string[] = ['is_active = $1', 'updated_at = NOW()'];
    const params: any[] = [isActive];
    let paramIndex = 2;

    if (planType !== undefined) {
      setClauses.push(`plan_type = $${paramIndex}`);
      params.push(planType);
      paramIndex++;
    }

    if (subscriptionExpiresAt !== undefined) {
      setClauses.push(`subscription_expires_at = $${paramIndex}`);
      params.push(subscriptionExpiresAt ?? null);
      paramIndex++;
    }

    params.push(id); // for the WHERE clause

    const result = await query(
      `UPDATE centers
         SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING
         id,
         name,
         location,
         contact_phone,
         contact_email,
         logo_url,
         is_active,
         head_coach_id,
         plan_type,
         subscription_expires_at,
         created_at,
         updated_at`,
      params
    );

    const row = result.rows[0];
    res.status(200).json({
      id: row.id,
      name: row.name,
      location: row.location,
      contactPhone: row.contact_phone,
      contactEmail: row.contact_email,
      logoUrl: row.logo_url,
      isActive: row.is_active,
      headCoachId: row.head_coach_id,
      planType: row.plan_type,
      subscriptionExpiresAt: row.subscription_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('Toggle center activation error:', error);
    res.status(500).json({ error: 'An error occurred while updating center activation' });
  }
};
