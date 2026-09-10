import { query } from '../config/database';
import { CoachRoyalty, CoachRoyaltyTotals } from '../types';

// Platform keeps 40%, the authoring coach keeps 60%. A single constant
// rather than a per-pack setting — see the coach_royalties migration for
// why coach_share_percent is still stored per-row (so a future change here
// never rewrites the split on past sales, only new ones).
export const COACH_SHARE_PERCENT = 60;

export function mapRowToCoachRoyalty(row: any): CoachRoyalty {
  return {
    id: row.id,
    centerSubscriptionId: row.center_subscription_id,
    drillSetId: row.drill_set_id,
    coachUserId: row.coach_user_id,
    purchasingCenterId: row.purchasing_center_id,
    saleAmount: parseFloat(row.sale_amount),
    coachSharePercent: parseFloat(row.coach_share_percent),
    coachAmount: parseFloat(row.coach_amount),
    platformAmount: parseFloat(row.platform_amount),
    status: row.status,
    paidAt: row.paid_at,
    paidBy: row.paid_by || null,
    payoutNote: row.payout_note || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    drillSetName: row.drill_set_name ?? undefined,
    coachName: row.coach_name ?? undefined,
    purchasingCenterName: row.purchasing_center_name ?? undefined,
  };
}

/**
 * Creates a royalty entry for a just-activated paid subscription, if (and
 * only if) the purchased item is a coach-authored drill pack — the official
 * catalog and non-drill-pack items (accounting, capacity add-ons) never
 * generate one. Idempotent on center_subscription_id (DB unique index), so
 * safe to call more than once for the same activation. Non-blocking by
 * design — callers should catch and log rather than fail the activation
 * over a royalty-bookkeeping error, same as the existing ledger entries.
 */
export async function createRoyaltyEntryForSubscription(
  centerSubscriptionId: string,
  marketplaceItemId: string,
  purchasingCenterId: string,
  saleAmount: number
): Promise<CoachRoyalty | null> {
  if (saleAmount <= 0) return null;

  const itemResult = await query(
    `SELECT mi.drill_set_id, ds.is_official, ds.created_by
     FROM marketplace_items mi
     JOIN drill_sets ds ON ds.id = mi.drill_set_id
     WHERE mi.id = $1 AND mi.category = 'DRILL_PACK' AND mi.drill_set_id IS NOT NULL`,
    [marketplaceItemId]
  );

  if (itemResult.rowCount === 0) return null;
  const { drill_set_id: drillSetId, is_official: isOfficial, created_by: coachUserId } = itemResult.rows[0];

  if (isOfficial || !coachUserId) return null;

  const coachAmount = Math.round(saleAmount * (COACH_SHARE_PERCENT / 100) * 100) / 100;
  const platformAmount = Math.round((saleAmount - coachAmount) * 100) / 100;

  const result = await query(
    `INSERT INTO coach_royalties
       (center_subscription_id, drill_set_id, coach_user_id, purchasing_center_id,
        sale_amount, coach_share_percent, coach_amount, platform_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (center_subscription_id) DO NOTHING
     RETURNING *`,
    [centerSubscriptionId, drillSetId, coachUserId, purchasingCenterId, saleAmount, COACH_SHARE_PERCENT, coachAmount, platformAmount]
  );

  if (result.rowCount === 0) return null;
  return mapRowToCoachRoyalty(result.rows[0]);
}

export interface ListRoyaltiesFilters {
  coachUserId?: string;
  status?: 'PENDING' | 'PAID';
}

export async function listRoyalties(filters: ListRoyaltiesFilters = {}): Promise<CoachRoyalty[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.coachUserId) {
    conditions.push(`cr.coach_user_id = $${paramIndex}`);
    params.push(filters.coachUserId);
    paramIndex++;
  }
  if (filters.status) {
    conditions.push(`cr.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT cr.*, ds.name AS drill_set_name, u.name AS coach_name, c.name AS purchasing_center_name
     FROM coach_royalties cr
     JOIN drill_sets ds ON ds.id = cr.drill_set_id
     JOIN users u ON u.id = cr.coach_user_id
     JOIN centers c ON c.id = cr.purchasing_center_id
     ${whereClause}
     ORDER BY cr.created_at DESC`,
    params
  );

  return result.rows.map(mapRowToCoachRoyalty);
}

export async function getCoachRoyaltyTotals(): Promise<CoachRoyaltyTotals[]> {
  const result = await query(
    `SELECT
       cr.coach_user_id,
       u.name AS coach_name,
       COALESCE(SUM(cr.coach_amount) FILTER (WHERE cr.status = 'PENDING'), 0) AS pending_amount,
       COALESCE(SUM(cr.coach_amount) FILTER (WHERE cr.status = 'PAID'), 0) AS paid_amount,
       COALESCE(SUM(cr.coach_amount), 0) AS lifetime_amount,
       COUNT(*) AS sale_count
     FROM coach_royalties cr
     JOIN users u ON u.id = cr.coach_user_id
     GROUP BY cr.coach_user_id, u.name
     ORDER BY pending_amount DESC, lifetime_amount DESC`
  );

  return result.rows.map((row: any) => ({
    coachUserId: row.coach_user_id,
    coachName: row.coach_name,
    pendingAmount: parseFloat(row.pending_amount),
    paidAmount: parseFloat(row.paid_amount),
    lifetimeAmount: parseFloat(row.lifetime_amount),
    saleCount: parseInt(row.sale_count, 10),
  }));
}

/**
 * Marks every still-pending royalty for one coach as paid in a single
 * batch — payouts happen offline (bank transfer, UPI, etc.) in one lump
 * sum per coach, not entry by entry, so this is the unit of work the admin
 * UI actually needs.
 */
export async function markCoachRoyaltiesPaid(
  coachUserId: string,
  paidBy: string,
  note?: string
): Promise<number> {
  const result = await query(
    `UPDATE coach_royalties
     SET status = 'PAID', paid_at = NOW(), paid_by = $1, payout_note = $2, updated_at = NOW()
     WHERE coach_user_id = $3 AND status = 'PENDING'`,
    [paidBy, note || null, coachUserId]
  );
  return result.rowCount || 0;
}
