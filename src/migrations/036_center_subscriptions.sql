-- Center Subscriptions Migration
-- Version: 036
-- Description: Join table recording which marketplace_items a center has
--              bought, admin-assisted (offline payment, admin activates).
--              A center can hold many active subscriptions at once — a
--              capacity tier, a drill pack, and Accounting are independent
--              purchases, not mutually exclusive tiers of one plan.
--              student_video_access_enabled is meaningful only when the
--              subscribed item is a DRILL_PACK at tier VIDEO_ENHANCED — it is
--              the center's own opt-in to let students watch the clips too,
--              off by default.
-- Date: 2026-09-03

CREATE TABLE IF NOT EXISTS center_subscriptions (
  id                            VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  center_id                     UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  marketplace_item_id           VARCHAR(50) NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
  status                        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  started_at                    TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at                    TIMESTAMP,
  activated_by                  UUID NOT NULL REFERENCES users(id),
  price_paid                    NUMERIC(10,2) NOT NULL DEFAULT 0,
  student_video_access_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at                    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE center_subscriptions ADD CONSTRAINT chk_center_subscriptions_status
  CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED'));

ALTER TABLE center_subscriptions ADD CONSTRAINT chk_center_subscriptions_price
  CHECK (price_paid >= 0);

-- Only one ACTIVE subscription per (center, item) at a time. Re-subscribing
-- after a cancellation creates a new row (new id), which is what keeps each
-- activation's ledger entry distinct — see ledgerService.createSubscriptionDebitEntry.
CREATE UNIQUE INDEX IF NOT EXISTS idx_center_sub_active
  ON center_subscriptions(center_id, marketplace_item_id) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_center_subscriptions_center_id ON center_subscriptions(center_id);
CREATE INDEX IF NOT EXISTS idx_center_subscriptions_item_id ON center_subscriptions(marketplace_item_id);
