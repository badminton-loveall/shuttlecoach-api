import { Pool, query } from '../config/database';
import { validateSlug } from '../utils/slug';
import { SlugChangeRequest } from '../types';

// ============================================================
// Slug Change Request Service — Multi-Center Roles
// ============================================================

/**
 * Creates a new slug change request for a center.
 *
 * Validates:
 *  - Slug format (via validateSlug)
 *  - Slug is not already in use by another center
 *  - No pending request already exists for this center
 *
 * @throws 400 — Invalid slug format
 * @throws 409 — Slug already taken
 * @throws 409 — Pending request already exists for center
 */
export async function createRequest(
  centerId: string,
  requestedSlug: string,
  requestedBy: string
): Promise<SlugChangeRequest> {
  // 1. Validate slug format
  const validation = validateSlug(requestedSlug);
  if (!validation.valid) {
    const err = new Error(validation.error || 'Invalid slug format');
    (err as any).statusCode = 400;
    throw err;
  }

  // 2. Check slug is not already in use
  const slugInUse = await query(
    `SELECT id FROM centers WHERE slug = $1`,
    [requestedSlug]
  );
  if (slugInUse.rows.length > 0) {
    const err = new Error('This slug is already taken');
    (err as any).statusCode = 409;
    throw err;
  }

  // 3. Check no pending request already exists for this center
  const pendingExists = await query(
    `SELECT id FROM slug_change_requests
     WHERE center_id = $1 AND status = 'PENDING'`,
    [centerId]
  );
  if (pendingExists.rows.length > 0) {
    const err = new Error('A pending slug change request already exists');
    (err as any).statusCode = 409;
    throw err;
  }

  // 4. Insert the request
  const result = await query(
    `INSERT INTO slug_change_requests (center_id, requested_slug, requested_by)
     VALUES ($1, $2, $3)
     RETURNING id, center_id, requested_slug, status, requested_by, reviewed_by, reviewed_at, created_at`,
    [centerId, requestedSlug, requestedBy]
  );

  return mapRequestRow(result.rows[0]);
}

/**
 * Retrieves all pending slug change requests, joined with center name.
 * Ordered by most recent first.
 */
export async function getPendingRequests(): Promise<
  Array<SlugChangeRequest & { centerName: string }>
> {
  const result = await query(
    `SELECT
       scr.id,
       scr.center_id,
       scr.requested_slug,
       scr.status,
       scr.requested_by,
       scr.reviewed_by,
       scr.reviewed_at,
       scr.created_at,
       c.name AS center_name
     FROM slug_change_requests scr
     JOIN centers c ON scr.center_id = c.id
     WHERE scr.status = 'PENDING'
     ORDER BY scr.created_at DESC`
  );

  return result.rows.map((row: any) => ({
    ...mapRequestRow(row),
    centerName: row.center_name,
  }));
}

/**
 * Returns the count of pending slug change requests.
 */
export async function getPendingCount(): Promise<number> {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM slug_change_requests WHERE status = 'PENDING'`
  );
  return result.rows[0].count;
}

/**
 * Approves a pending slug change request.
 *
 * Runs in a transaction:
 *  1. Verify the requested slug is still available
 *  2. Update the center's slug
 *  3. Mark the request as APPROVED with reviewer info
 *
 * @throws 404 — Request not found or not pending
 * @throws 409 — Slug is no longer available
 */
export async function approveRequest(
  requestId: string,
  reviewedBy: string
): Promise<SlugChangeRequest> {
  const pool = Pool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch the pending request
    const reqResult = await client.query(
      `SELECT id, center_id, requested_slug, status
       FROM slug_change_requests
       WHERE id = $1 AND status = 'PENDING'`,
      [requestId]
    );

    if (reqResult.rows.length === 0) {
      const err = new Error('Request not found or already reviewed');
      (err as any).statusCode = 404;
      throw err;
    }

    const request = reqResult.rows[0];

    // 2. Verify slug is still available
    const slugCheck = await client.query(
      `SELECT id FROM centers WHERE slug = $1`,
      [request.requested_slug]
    );

    if (slugCheck.rows.length > 0) {
      const err = new Error('Slug is no longer available');
      (err as any).statusCode = 409;
      throw err;
    }

    // 3. Update center slug
    await client.query(
      `UPDATE centers SET slug = $1, updated_at = NOW() WHERE id = $2`,
      [request.requested_slug, request.center_id]
    );

    // 4. Mark request as APPROVED
    const updatedResult = await client.query(
      `UPDATE slug_change_requests
       SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2
       RETURNING id, center_id, requested_slug, status, requested_by, reviewed_by, reviewed_at, created_at`,
      [reviewedBy, requestId]
    );

    await client.query('COMMIT');

    return mapRequestRow(updatedResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rejects a pending slug change request.
 * Marks the request as REJECTED; the center's slug remains unchanged.
 *
 * @throws 404 — Request not found or not pending
 */
export async function rejectRequest(
  requestId: string,
  reviewedBy: string
): Promise<SlugChangeRequest> {
  const result = await query(
    `UPDATE slug_change_requests
     SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW()
     WHERE id = $2 AND status = 'PENDING'
     RETURNING id, center_id, requested_slug, status, requested_by, reviewed_by, reviewed_at, created_at`,
    [reviewedBy, requestId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Request not found or already reviewed');
    (err as any).statusCode = 404;
    throw err;
  }

  return mapRequestRow(result.rows[0]);
}

/**
 * Checks if a center has a pending slug change request.
 * Used by HEAD_COACH to determine if "Request Change" should be disabled.
 */
export async function hasPendingRequestForCenter(centerId: string): Promise<boolean> {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM slug_change_requests
     WHERE center_id = $1 AND status = 'PENDING'`,
    [centerId]
  );
  return result.rows[0].count > 0;
}

// ============================================================
// Helpers
// ============================================================

function mapRequestRow(row: any): SlugChangeRequest {
  return {
    id: row.id,
    centerId: row.center_id,
    requestedSlug: row.requested_slug,
    status: row.status,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    createdAt: row.created_at,
  };
}
