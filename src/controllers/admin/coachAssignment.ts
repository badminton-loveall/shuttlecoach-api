import { Response } from 'express';
import { Pool, query } from '../../config/database';
import { UserRole } from '../../types';
import { AuthRequest } from '../../middleware/auth';

/**
 * POST /api/admin/centers/:id/assign-coach
 *
 * Assigns a HEAD_COACH user to the specified center.
 *
 * Business rules (Requirements 3.1, 3.2, 3.4):
 * - The coach must exist and have role HEAD_COACH
 * - The coach must NOT already be the head_coach of another ACTIVE center
 * - Updates centers.head_coach_id and users.center_id atomically in a transaction
 * - Returns the updated center record
 */
export const assignCoach = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const centerId = req.params.id;
  const { coachId } = req.body;

  if (!coachId) {
    res.status(400).json({ error: 'coachId is required (UUID or email)' });
    return;
  }

  // Verify the target center exists
  const centerResult = await query(
    'SELECT id, name, is_active FROM centers WHERE id = $1',
    [centerId]
  );

  if (centerResult.rows.length === 0) {
    res.status(404).json({ error: 'Center not found' });
    return;
  }

  // Resolve coachId: accept UUID or email
  let resolvedCoachId = coachId;
  const isEmail = coachId.includes('@');

  if (isEmail) {
    const emailLookup = await query(
      'SELECT id FROM users WHERE email = $1',
      [coachId]
    );
    if (emailLookup.rows.length === 0) {
      res.status(404).json({ error: 'No user found with that email' });
      return;
    }
    resolvedCoachId = emailLookup.rows[0].id;
  }

  // Verify the coach exists and has the HEAD_COACH role
  const coachResult = await query(
    'SELECT id, role, center_id FROM users WHERE id = $1',
    [resolvedCoachId]
  );

  if (coachResult.rows.length === 0) {
    res.status(404).json({ error: 'Coach not found' });
    return;
  }

  const coach = coachResult.rows[0];

  if (coach.role !== UserRole.HEAD_COACH) {
    res.status(400).json({ error: 'User is not a HEAD_COACH' });
    return;
  }

  // Check if this coach is already the head coach of another ACTIVE center
  const conflictResult = await query(
    `SELECT c.id, c.name
     FROM centers c
     WHERE c.head_coach_id = $1
       AND c.is_active = true
       AND c.id <> $2`,
    [resolvedCoachId, centerId]
  );

  if (conflictResult.rows.length > 0) {
    const conflictCenter = conflictResult.rows[0];
    res.status(409).json({
      error: 'This coach is already assigned to another active center',
      conflictingCenter: {
        id: conflictCenter.id,
        name: conflictCenter.name,
      },
    });
    return;
  }

  // Run both updates atomically
  const pool = Pool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update centers.head_coach_id
    const updatedCenter = await client.query(
      `UPDATE centers
       SET head_coach_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, location, contact_phone, contact_email, logo_url,
                 is_active, head_coach_id, plan_type, subscription_expires_at,
                 created_at, updated_at`,
      [resolvedCoachId, centerId]
    );

    // Update users.center_id for the new coach
    await client.query(
      'UPDATE users SET center_id = $1 WHERE id = $2',
      [centerId, resolvedCoachId]
    );

    await client.query('COMMIT');

    const center = updatedCenter.rows[0];
    res.status(200).json({
      id: center.id,
      name: center.name,
      location: center.location,
      contactPhone: center.contact_phone,
      contactEmail: center.contact_email,
      logoUrl: center.logo_url,
      isActive: center.is_active,
      headCoachId: center.head_coach_id,
      planType: center.plan_type,
      subscriptionExpiresAt: center.subscription_expires_at,
      createdAt: center.created_at,
      updatedAt: center.updated_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('assignCoach transaction error:', error);
    res.status(500).json({ error: 'An error occurred while assigning the coach' });
  } finally {
    client.release();
  }
};

/**
 * POST /api/admin/centers/:id/unassign-coach
 *
 * Removes the head coach assignment from the specified center.
 *
 * Business rules (Requirements 3.1, 3.2, 3.4):
 * - Clears centers.head_coach_id (set to NULL)
 * - Clears the coach's users.center_id (set to NULL)
 * - Both updates run in a transaction for atomicity
 * - Returns success
 */
export const unassignCoach = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const centerId = req.params.id;

  // Fetch the current head_coach_id for this center
  const centerResult = await query(
    'SELECT id, head_coach_id FROM centers WHERE id = $1',
    [centerId]
  );

  if (centerResult.rows.length === 0) {
    res.status(404).json({ error: 'Center not found' });
    return;
  }

  const center = centerResult.rows[0];

  if (!center.head_coach_id) {
    // Nothing to unassign — idempotent success
    res.status(200).json({ success: true, message: 'No coach was assigned to this center' });
    return;
  }

  const currentCoachId: string = center.head_coach_id;

  // Run both clears atomically
  const pool = Pool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear centers.head_coach_id
    await client.query(
      'UPDATE centers SET head_coach_id = NULL, updated_at = NOW() WHERE id = $1',
      [centerId]
    );

    // Clear the coach's users.center_id
    await client.query(
      'UPDATE users SET center_id = NULL WHERE id = $1',
      [currentCoachId]
    );

    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'Coach unassigned successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('unassignCoach transaction error:', error);
    res.status(500).json({ error: 'An error occurred while unassigning the coach' });
  } finally {
    client.release();
  }
};
