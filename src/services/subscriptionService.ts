import { query } from '../config/database';
import { createSubscriptionDebitEntry } from './ledgerService';
import { MarketplaceItem, CenterSubscription } from '../types';

// ============================================================
// Subscription Service — Marketplace Catalog and Activation
// ============================================================

export function mapMarketplaceItemRow(row: any): MarketplaceItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    drillSetId: row.drill_set_id,
    tier: row.tier,
    capacityLimit: row.capacity_limit,
    price: parseFloat(row.price),
    billingPeriod: row.billing_period,
    durationDays: row.duration_days,
    isEnabled: row.is_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCenterSubscriptionRow(row: any): CenterSubscription {
  return {
    id: row.id,
    centerId: row.center_id,
    marketplaceItemId: row.marketplace_item_id,
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    activatedBy: row.activated_by,
    pricePaid: parseFloat(row.price_paid),
    studentVideoAccessEnabled: row.student_video_access_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.item_name !== undefined ? { itemName: row.item_name } : {}),
    ...(row.item_category !== undefined ? { itemCategory: row.item_category } : {}),
    ...(row.item_price !== undefined ? { itemPrice: parseFloat(row.item_price) } : {}),
    ...(row.center_name !== undefined ? { centerName: row.center_name } : {}),
  };
}

/**
 * The marketplace catalog. Center-facing browsing only ever sees enabled
 * items; admin can pass includeDisabled to manage the full catalog.
 */
export async function listCatalog(includeDisabled = false): Promise<MarketplaceItem[]> {
  const result = await query(
    `SELECT * FROM marketplace_items ${includeDisabled ? '' : 'WHERE is_enabled = true'} ORDER BY category, price`
  );
  return result.rows.map(mapMarketplaceItemRow);
}

/**
 * A center's currently active subscriptions, enriched with the item's
 * name/category for display (e.g. the Accounting Section's subscriptions panel).
 */
export async function getActiveSubscriptions(centerId: string): Promise<CenterSubscription[]> {
  const result = await query(
    `SELECT cs.*, mi.name AS item_name, mi.category AS item_category
     FROM center_subscriptions cs
     JOIN marketplace_items mi ON mi.id = cs.marketplace_item_id
     WHERE cs.center_id = $1 AND cs.status = 'ACTIVE'
       AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
     ORDER BY cs.started_at DESC`,
    [centerId]
  );
  return result.rows.map(mapCenterSubscriptionRow);
}

/**
 * A center with no active capacity subscription at all still gets this many
 * seats — the free baseline every new center starts with. Kept only as a
 * last-resort fallback; in practice the catalog's own ₹0 baseline item
 * (below) is what actually governs this number, so an admin can raise or
 * lower it without a code change.
 */
export const DEFAULT_FREE_CAPACITY = 2;

/**
 * How many coaches/students a center may currently have. Prefers the
 * highest active COACH_CAPACITY/STUDENT_CAPACITY subscription's limit;
 * falls back to the catalog's own free (₹0) baseline tier for that
 * category (e.g. "2 Coaches (Free)"), and only falls back to the hardcoded
 * default above if the catalog has no baseline row at all.
 */
export async function getEffectiveCapacity(
  centerId: string,
  category: 'COACH_CAPACITY' | 'STUDENT_CAPACITY'
): Promise<number> {
  const activeResult = await query(
    `SELECT mi.capacity_limit FROM center_subscriptions cs
     JOIN marketplace_items mi ON mi.id = cs.marketplace_item_id
     WHERE cs.center_id = $1 AND mi.category = $2 AND cs.status = 'ACTIVE'
       AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       AND mi.capacity_limit IS NOT NULL
     ORDER BY mi.capacity_limit DESC LIMIT 1`,
    [centerId, category]
  );
  if (activeResult.rows.length > 0) {
    return activeResult.rows[0].capacity_limit;
  }

  const baselineResult = await query(
    `SELECT capacity_limit FROM marketplace_items
     WHERE category = $1 AND price = 0 AND is_enabled = true AND capacity_limit IS NOT NULL
     ORDER BY capacity_limit ASC LIMIT 1`,
    [category]
  );
  if (baselineResult.rows.length > 0) {
    return baselineResult.rows[0].capacity_limit;
  }

  return DEFAULT_FREE_CAPACITY;
}

export async function hasActiveSubscription(
  centerId: string,
  marketplaceItemId: string
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM center_subscriptions
     WHERE center_id = $1 AND marketplace_item_id = $2 AND status = 'ACTIVE'
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [centerId, marketplaceItemId]
  );
  return result.rows.length > 0;
}

/**
 * Admin-assisted activation: the center already paid offline, admin records
 * it here. Assumes the caller (the admin controller) has already checked the
 * item exists, is enabled, and isn't already actively subscribed — this stays
 * a thin data operation plus its one side effect, the ledger entry.
 */
export async function activateSubscription(
  centerId: string,
  marketplaceItemId: string,
  activatedBy: string,
  options: { priceOverride?: number; expiresAt?: string } = {}
): Promise<CenterSubscription> {
  const itemResult = await query('SELECT * FROM marketplace_items WHERE id = $1', [marketplaceItemId]);
  if (itemResult.rowCount === 0) {
    throw new Error('MARKETPLACE_ITEM_NOT_FOUND');
  }
  const item = itemResult.rows[0];

  const pricePaid = options.priceOverride ?? parseFloat(item.price);

  let expiresAt: string | null = options.expiresAt ?? null;
  if (!expiresAt && item.duration_days) {
    const d = new Date();
    d.setDate(d.getDate() + item.duration_days);
    expiresAt = d.toISOString();
  }

  const result = await query(
    `INSERT INTO center_subscriptions (center_id, marketplace_item_id, status, expires_at, activated_by, price_paid)
     VALUES ($1, $2, 'ACTIVE', $3, $4, $5)
     RETURNING *`,
    [centerId, marketplaceItemId, expiresAt, activatedBy, pricePaid]
  );

  const subscription = result.rows[0];

  // A ₹0 activation has no money movement — skip the ledger write entirely
  // rather than recording a zero-amount entry.
  if (pricePaid > 0) {
    try {
      await createSubscriptionDebitEntry(
        {
          id: subscription.id,
          amount: pricePaid,
          activatedDate: new Date().toISOString().split('T')[0],
          itemName: item.name,
        },
        centerId
      );
    } catch (ledgerErr) {
      console.error('[Subscriptions] Failed to create ledger entry:', ledgerErr);
      // Non-blocking: don't fail the activation
    }
  }

  return mapCenterSubscriptionRow(subscription);
}

/**
 * Admin cancels a center's active subscription for one item. Soft — the row
 * stays for history, only its status changes; nothing about the underlying
 * drill set or content is touched.
 */
export async function deactivateSubscription(
  centerId: string,
  marketplaceItemId: string
): Promise<CenterSubscription | null> {
  const result = await query(
    `UPDATE center_subscriptions SET status = 'CANCELLED', updated_at = NOW()
     WHERE center_id = $1 AND marketplace_item_id = $2 AND status = 'ACTIVE'
     RETURNING *`,
    [centerId, marketplaceItemId]
  );
  if (result.rowCount === 0) return null;
  return mapCenterSubscriptionRow(result.rows[0]);
}

function computeExpiresAt(durationDays: number | null, override?: string): string | null {
  if (override) return override;
  if (!durationDays) return null;
  const d = new Date();
  d.setDate(d.getDate() + durationDays);
  return d.toISOString();
}

async function recordSubscriptionDebitIfPaid(
  subscriptionId: string,
  itemName: string,
  pricePaid: number,
  centerId: string
): Promise<void> {
  if (pricePaid <= 0) return;
  try {
    await createSubscriptionDebitEntry(
      { id: subscriptionId, amount: pricePaid, activatedDate: new Date().toISOString().split('T')[0], itemName },
      centerId
    );
  } catch (ledgerErr) {
    console.error('[Subscriptions] Failed to create ledger entry:', ledgerErr);
  }
}

export async function hasPendingRequest(centerId: string, marketplaceItemId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM center_subscriptions
     WHERE center_id = $1 AND marketplace_item_id = $2 AND status = 'PENDING' LIMIT 1`,
    [centerId, marketplaceItemId]
  );
  return result.rows.length > 0;
}

/**
 * Coach self-serve: a free (price = 0) item activates immediately, no admin
 * step. A paid item creates a PENDING row instead — a request awaiting
 * admin approval. Returns the resulting row plus whether it went live now.
 */
export async function requestSubscription(
  centerId: string,
  marketplaceItemId: string,
  requestedBy: string
): Promise<{ subscription: CenterSubscription; autoActivated: boolean }> {
  const itemResult = await query('SELECT * FROM marketplace_items WHERE id = $1', [marketplaceItemId]);
  if (itemResult.rowCount === 0) {
    throw new Error('MARKETPLACE_ITEM_NOT_FOUND');
  }
  const item = itemResult.rows[0];

  if (!item.is_enabled) {
    throw new Error('ITEM_NOT_ENABLED');
  }
  if (await hasActiveSubscription(centerId, marketplaceItemId)) {
    throw new Error('ALREADY_SUBSCRIBED');
  }
  if (await hasPendingRequest(centerId, marketplaceItemId)) {
    throw new Error('ALREADY_REQUESTED');
  }

  const price = parseFloat(item.price);

  if (price === 0) {
    const subscription = await activateSubscription(centerId, marketplaceItemId, requestedBy);
    return { subscription, autoActivated: true };
  }

  const result = await query(
    `INSERT INTO center_subscriptions (center_id, marketplace_item_id, status, activated_by, price_paid)
     VALUES ($1, $2, 'PENDING', $3, 0)
     RETURNING *`,
    [centerId, marketplaceItemId, requestedBy]
  );
  return { subscription: mapCenterSubscriptionRow(result.rows[0]), autoActivated: false };
}

/** A center's own pending requests, enriched for display. */
export async function getCenterRequests(centerId: string): Promise<CenterSubscription[]> {
  const result = await query(
    `SELECT cs.*, mi.name AS item_name, mi.category AS item_category, mi.price AS item_price
     FROM center_subscriptions cs
     JOIN marketplace_items mi ON mi.id = cs.marketplace_item_id
     WHERE cs.center_id = $1 AND cs.status = 'PENDING'
     ORDER BY cs.created_at DESC`,
    [centerId]
  );
  return result.rows.map(mapCenterSubscriptionRow);
}

/** Every center's pending requests — the admin approval queue. */
export async function getPendingRequests(): Promise<CenterSubscription[]> {
  const result = await query(
    `SELECT cs.*, mi.name AS item_name, mi.category AS item_category, mi.price AS item_price, c.name AS center_name
     FROM center_subscriptions cs
     JOIN marketplace_items mi ON mi.id = cs.marketplace_item_id
     JOIN centers c ON c.id = cs.center_id
     WHERE cs.status = 'PENDING'
     ORDER BY cs.created_at ASC`
  );
  return result.rows.map(mapCenterSubscriptionRow);
}

/**
 * Admin approves a pending request: the center paid offline, admin confirms
 * it here. Same activation record either way — only its origin (a coach's
 * request vs. admin picking an item directly) differs.
 */
export async function approveRequest(
  requestId: string,
  approvedBy: string,
  options: { priceOverride?: number; expiresAt?: string } = {}
): Promise<CenterSubscription | null> {
  const requestResult = await query(
    `SELECT cs.*, mi.name AS item_name, mi.price AS item_price, mi.duration_days
     FROM center_subscriptions cs
     JOIN marketplace_items mi ON mi.id = cs.marketplace_item_id
     WHERE cs.id = $1 AND cs.status = 'PENDING'`,
    [requestId]
  );
  if (requestResult.rowCount === 0) return null;
  const request = requestResult.rows[0];

  const pricePaid = options.priceOverride ?? parseFloat(request.item_price);
  const expiresAt = computeExpiresAt(request.duration_days, options.expiresAt);

  const result = await query(
    `UPDATE center_subscriptions
       SET status = 'ACTIVE', started_at = NOW(), expires_at = $1, price_paid = $2, activated_by = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [expiresAt, pricePaid, approvedBy, requestId]
  );

  const subscription = result.rows[0];
  await recordSubscriptionDebitIfPaid(subscription.id, request.item_name, pricePaid, subscription.center_id);
  return mapCenterSubscriptionRow(subscription);
}

export interface ItemRevenue {
  itemId: string;
  itemName: string;
  category: string;
  price: number;
  activeCount: number;
  totalRevenue: number;
}

/**
 * Revenue ranking per catalog item — every payment ever collected for it
 * (ACTIVE, EXPIRED, or CANCELLED all counted; a cancelled subscription still
 * generated real revenue while it ran), plus how many centers hold it now.
 */
export async function getRevenueByItem(): Promise<ItemRevenue[]> {
  const result = await query(
    `SELECT
       mi.id, mi.name, mi.category, mi.price,
       COUNT(cs.id) FILTER (WHERE cs.status = 'ACTIVE') AS active_count,
       COALESCE(SUM(cs.price_paid) FILTER (WHERE cs.status IN ('ACTIVE', 'EXPIRED', 'CANCELLED')), 0) AS total_revenue
     FROM marketplace_items mi
     LEFT JOIN center_subscriptions cs ON cs.marketplace_item_id = mi.id
     GROUP BY mi.id, mi.name, mi.category, mi.price
     ORDER BY total_revenue DESC, active_count DESC`
  );
  return result.rows.map((row) => ({
    itemId: row.id,
    itemName: row.name,
    category: row.category,
    price: parseFloat(row.price),
    activeCount: Number(row.active_count),
    totalRevenue: parseFloat(row.total_revenue),
  }));
}

/**
 * Every center's subscription history across every item, for the admin
 * "who's subscribed to what, and what did they pay" view.
 */
export async function getAllCenterSubscriptions(): Promise<CenterSubscription[]> {
  const result = await query(
    `SELECT cs.*, mi.name AS item_name, mi.category AS item_category, c.name AS center_name
     FROM center_subscriptions cs
     JOIN marketplace_items mi ON mi.id = cs.marketplace_item_id
     JOIN centers c ON c.id = cs.center_id
     WHERE cs.status != 'REJECTED'
     ORDER BY c.name, cs.started_at DESC`
  );
  return result.rows.map(mapCenterSubscriptionRow);
}

export async function rejectRequest(requestId: string): Promise<CenterSubscription | null> {
  const result = await query(
    `UPDATE center_subscriptions SET status = 'REJECTED', updated_at = NOW()
     WHERE id = $1 AND status = 'PENDING'
     RETURNING *`,
    [requestId]
  );
  if (result.rowCount === 0) return null;
  return mapCenterSubscriptionRow(result.rows[0]);
}
