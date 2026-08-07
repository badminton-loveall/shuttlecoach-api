import { query } from '../config/database';
import { CenterMembership, UserCenterMembership, UserRole } from '../types';

// ============================================================
// Membership Service — Multi-Center Roles
// ============================================================

/**
 * Retrieves all memberships for a user, joined with the centers table
 * to include center name. Ordered by earliest created first.
 */
export async function getMembershipsByUserId(
  userId: string
): Promise<CenterMembership[]> {
  const result = await query(
    `SELECT
       ucm.center_id,
       c.name AS center_name,
       ucm.role,
       ucm.can_access_fees
     FROM user_center_memberships ucm
     JOIN centers c ON ucm.center_id = c.id
     WHERE ucm.user_id = $1
     ORDER BY ucm.created_at ASC`,
    [userId]
  );

  return result.rows.map((row: any) => ({
    centerId: row.center_id,
    centerName: row.center_name,
    role: row.role as UserRole,
    canAccessFees: row.can_access_fees,
  }));
}

/**
 * Retrieves a single membership record for a user at a specific center.
 * Returns null if no membership exists.
 */
export async function getMembership(
  userId: string,
  centerId: string
): Promise<UserCenterMembership | null> {
  const result = await query(
    `SELECT id, user_id, center_id, role, can_access_fees, created_at
     FROM user_center_memberships
     WHERE user_id = $1 AND center_id = $2`,
    [userId, centerId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapMembershipRow(result.rows[0]);
}

/**
 * Creates a new membership record for a user at a center with a given role.
 * Handles:
 *  - 409 Conflict if duplicate (user_id, center_id, role) — PostgreSQL error code 23505
 *  - 422 Unprocessable Entity if max 20 memberships exceeded (trigger exception)
 */
export async function createMembership(
  userId: string,
  centerId: string,
  role: UserRole,
  canAccessFees: boolean = false
): Promise<UserCenterMembership> {
  try {
    const result = await query(
      `INSERT INTO user_center_memberships (user_id, center_id, role, can_access_fees)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, center_id, role, can_access_fees, created_at`,
      [userId, centerId, role, canAccessFees]
    );

    return mapMembershipRow(result.rows[0]);
  } catch (error: any) {
    // PostgreSQL unique violation (duplicate membership)
    if (error.code === '23505') {
      const err = new Error(
        'Membership already exists for this user, center, and role'
      );
      (err as any).statusCode = 409;
      throw err;
    }

    // Trigger-raised exception for max memberships (raise exception in PL/pgSQL)
    if (
      error.code === 'P0001' ||
      (error.message && error.message.includes('20 centers'))
    ) {
      const err = new Error(
        'User cannot belong to more than 20 centers'
      );
      (err as any).statusCode = 422;
      throw err;
    }

    throw error;
  }
}

/**
 * Removes a membership record for a user at a center with the specified role.
 * Returns true if a record was deleted, false if none matched.
 */
export async function removeMembership(
  userId: string,
  centerId: string,
  role: UserRole
): Promise<boolean> {
  const result = await query(
    `DELETE FROM user_center_memberships
     WHERE user_id = $1 AND center_id = $2 AND role = $3`,
    [userId, centerId, role]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Validates whether a user has any membership at a given center.
 * Returns true if at least one membership exists.
 */
export async function validateMembership(
  userId: string,
  centerId: string
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM user_center_memberships
     WHERE user_id = $1 AND center_id = $2
     LIMIT 1`,
    [userId, centerId]
  );

  return result.rows.length > 0;
}

// ============================================================
// Helpers
// ============================================================

function mapMembershipRow(row: any): UserCenterMembership {
  return {
    id: row.id,
    userId: row.user_id,
    centerId: row.center_id,
    role: row.role as UserRole,
    canAccessFees: row.can_access_fees,
    createdAt: row.created_at,
  };
}
