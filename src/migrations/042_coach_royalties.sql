-- Coach Royalties Migration
-- Version: 042
-- Description: Platform-wide royalty ledger — separate from ledger_entries
--              (which is scoped to a single center's own income/expense
--              books). One row here is created per paid center_subscriptions
--              activation of a coach-authored (non-official) drill pack,
--              splitting price_paid 60% to the coach who created the pack
--              and 40% to the platform. Recurring by nature: every center
--              that later subscribes to the same pack creates another row,
--              so a popular pack keeps earning its creator over time. The
--              official Badminton Drills Pack (is_official = true, no coach
--              owner) never generates a royalty row.
-- Date: 2026-09-11

CREATE TABLE IF NOT EXISTS coach_royalties (
  id                     VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  center_subscription_id VARCHAR(50) NOT NULL REFERENCES center_subscriptions(id) ON DELETE CASCADE,
  drill_set_id           VARCHAR(50) NOT NULL REFERENCES drill_sets(id) ON DELETE CASCADE,
  coach_user_id          UUID NOT NULL REFERENCES users(id),
  purchasing_center_id   UUID NOT NULL REFERENCES centers(id),
  sale_amount            NUMERIC(10,2) NOT NULL,
  coach_share_percent    NUMERIC(5,2) NOT NULL DEFAULT 60,
  coach_amount           NUMERIC(10,2) NOT NULL,
  platform_amount        NUMERIC(10,2) NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  paid_at                TIMESTAMP,
  paid_by                UUID REFERENCES users(id),
  payout_note            TEXT,
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE coach_royalties ADD CONSTRAINT chk_coach_royalties_status
  CHECK (status IN ('PENDING', 'PAID'));

ALTER TABLE coach_royalties ADD CONSTRAINT chk_coach_royalties_amounts
  CHECK (sale_amount >= 0 AND coach_amount >= 0 AND platform_amount >= 0);

-- One royalty row per subscription activation — the same idempotency
-- pattern as ledger_entries' duplicate check, enforced here at the DB
-- level via a unique constraint instead of an application-side lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coach_royalties_subscription
  ON coach_royalties(center_subscription_id);

CREATE INDEX IF NOT EXISTS idx_coach_royalties_coach ON coach_royalties(coach_user_id);
CREATE INDEX IF NOT EXISTS idx_coach_royalties_status ON coach_royalties(status);
CREATE INDEX IF NOT EXISTS idx_coach_royalties_drill_set ON coach_royalties(drill_set_id);
