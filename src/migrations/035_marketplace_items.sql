-- Marketplace Items Catalog Migration
-- Version: 035
-- Description: A single flexible catalog table for everything a center can
--              subscribe to — drill packs (Standard or Video-Enhanced listings
--              of an existing drill_sets row), the Accounting Section, and
--              capacity add-ons (student/coach limits). Every item has its own
--              admin-editable price; price = 0 is displayed as "Free" in the
--              marketplace UI. duration_days lets any item (free or paid)
--              auto-expire a fixed number of days after activation — used for
--              time-limited demos (e.g. "Accounting — free for 2 months") as
--              well as ordinary indefinite subscriptions (duration_days NULL).
--              is_enabled is the global, platform-wide Catalog Switch.
-- Date: 2026-09-03

-- ============================================================================
-- 1. CREATE marketplace_items TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_items (
  id             VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           VARCHAR(150) NOT NULL,
  description    TEXT,
  category       VARCHAR(20) NOT NULL,
  drill_set_id   VARCHAR(50) REFERENCES drill_sets(id) ON DELETE CASCADE,
  tier           VARCHAR(20),
  capacity_limit INTEGER,
  price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  billing_period VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
  duration_days  INTEGER,
  is_enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE marketplace_items ADD CONSTRAINT chk_marketplace_items_category
  CHECK (category IN ('DRILL_PACK', 'ACCOUNTING', 'STUDENT_CAPACITY', 'COACH_CAPACITY'));

ALTER TABLE marketplace_items ADD CONSTRAINT chk_marketplace_items_tier
  CHECK (tier IS NULL OR tier IN ('STANDARD', 'VIDEO_ENHANCED'));

ALTER TABLE marketplace_items ADD CONSTRAINT chk_marketplace_items_price
  CHECK (price >= 0);

ALTER TABLE marketplace_items ADD CONSTRAINT chk_marketplace_items_duration
  CHECK (duration_days IS NULL OR duration_days > 0);

-- Only one catalog row per (drill set, tier) pairing — this is how a single
-- drill_sets row becomes two independently priced listings ("with video" /
-- "without video"). Items with no drill_set_id (ACCOUNTING, capacity tiers)
-- are unrestricted by this index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_items_drill_tier
  ON marketplace_items(drill_set_id, tier) WHERE drill_set_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_items_category ON marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_enabled ON marketplace_items(is_enabled);

-- ============================================================================
-- 2. SEED — illustrative starter catalog, all fields editable from Admin
-- ============================================================================

INSERT INTO marketplace_items (name, description, category, drill_set_id, tier, price)
SELECT 'Badminton Drills Pack (Standard)', 'The official badminton drill catalog — names, descriptions, categories.',
       'DRILL_PACK', 'official-badminton-pack', 'STANDARD', 1000
WHERE EXISTS (SELECT 1 FROM drill_sets WHERE id = 'official-badminton-pack')
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_items (name, description, category, drill_set_id, tier, price)
SELECT 'Badminton Drills Pack (with Video Tutorials)', 'The same official drill catalog, with a short demonstration clip on every drill Loveall has filmed.',
       'DRILL_PACK', 'official-badminton-pack', 'VIDEO_ENHANCED', 2500
WHERE EXISTS (SELECT 1 FROM drill_sets WHERE id = 'official-badminton-pack')
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_items (name, description, category, price)
VALUES ('Accounting Section', 'Subscription payments, coach salaries, student fees, and other expenses in one dashboard.', 'ACCOUNTING', 1000)
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_items (name, description, category, price, duration_days)
VALUES ('Accounting Section — Free Trial', 'Try the Accounting Section free for two months.', 'ACCOUNTING', 0, 60)
ON CONFLICT DO NOTHING;

INSERT INTO marketplace_items (name, description, category, capacity_limit, price)
VALUES
  ('2 Students (Free)', 'A permanent free baseline for small or trial centers.', 'STUDENT_CAPACITY', 2, 0),
  ('10 Students', NULL, 'STUDENT_CAPACITY', 10, 1000),
  ('50 Students', NULL, 'STUDENT_CAPACITY', 50, 4500),
  ('2 Coaches (Free)', 'A permanent free baseline for small or trial centers.', 'COACH_CAPACITY', 2, 0),
  ('5 Coaches', NULL, 'COACH_CAPACITY', 5, 1000)
ON CONFLICT DO NOTHING;
