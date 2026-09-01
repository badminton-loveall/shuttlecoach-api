-- Drill Set Marketplace Migration
-- Version: 031
-- Description: Coach-owned Drill Sets (a named bundle containing Categories,
--              each Category holding existing center drills), submitted for
--              admin review, and — once published — adoptable by other centers
--              via the existing drill Marketplace surface. Also adds a
--              per-center admin toggle controlling Marketplace tab visibility.
-- Date: 2026-09-01

-- ============================================================================
-- 1. CREATE drill_sets TABLE (top-level, coach-owned, review/publish lifecycle)
-- ============================================================================

CREATE TABLE IF NOT EXISTS drill_sets (
  id                VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  sport             VARCHAR(30),
  center_id         UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  created_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft',
  submitted_at      TIMESTAMP,
  reviewed_by       UUID REFERENCES users(id),
  reviewed_at       TIMESTAMP,
  rejection_reason  TEXT,
  source_set_id     VARCHAR(50) REFERENCES drill_sets(id) ON DELETE SET NULL,
  is_archived       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE drill_sets ADD CONSTRAINT chk_drill_sets_sport
  CHECK (sport IS NULL OR sport IN ('badminton', 'tennis', 'table_tennis', 'squash'));

ALTER TABLE drill_sets ADD CONSTRAINT chk_drill_sets_status
  CHECK (status IN ('draft', 'pending_review', 'published', 'rejected'));

-- ============================================================================
-- 2. CREATE drill_set_categories TABLE (named sub-groups within a set)
-- ============================================================================

CREATE TABLE IF NOT EXISTS drill_set_categories (
  id          VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  set_id      VARCHAR(50) NOT NULL REFERENCES drill_sets(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. CREATE drill_set_category_drills TABLE (drills placed under a set-category)
-- ============================================================================

CREATE TABLE IF NOT EXISTS drill_set_category_drills (
  id               VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  set_category_id  VARCHAR(50) NOT NULL REFERENCES drill_set_categories(id) ON DELETE CASCADE,
  drill_id         VARCHAR(50) NOT NULL REFERENCES drills(id) ON DELETE CASCADE,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (set_category_id, drill_id)
);

-- ============================================================================
-- 4. ADD marketplace_enabled TOGGLE TO centers (admin-controlled, default on)
-- ============================================================================

ALTER TABLE centers ADD COLUMN IF NOT EXISTS marketplace_enabled BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_drill_sets_created_by ON drill_sets(created_by);
CREATE INDEX IF NOT EXISTS idx_drill_sets_center_id ON drill_sets(center_id);
CREATE INDEX IF NOT EXISTS idx_drill_sets_status ON drill_sets(status);
CREATE INDEX IF NOT EXISTS idx_drill_sets_source_set_id ON drill_sets(source_set_id);
CREATE INDEX IF NOT EXISTS idx_drill_set_categories_set_id ON drill_set_categories(set_id);
CREATE INDEX IF NOT EXISTS idx_drill_set_category_drills_set_category_id ON drill_set_category_drills(set_category_id);
CREATE INDEX IF NOT EXISTS idx_drill_set_category_drills_drill_id ON drill_set_category_drills(drill_id);
