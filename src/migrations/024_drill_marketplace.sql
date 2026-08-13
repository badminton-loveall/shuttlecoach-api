-- Drill Marketplace Migration
-- Version: 024
-- Description: Add sport dimension to drills and centers, add source_drill_id for
--              adoption lineage tracking, and make drills.center_id nullable to
--              support platform-level Global Drills (center_id = NULL).
-- Date: 2025-01-01

-- ============================================================================
-- 1. MAKE drills.center_id NULLABLE (Global Drills have NULL center_id)
-- ============================================================================

ALTER TABLE drills ALTER COLUMN center_id DROP NOT NULL;

-- ============================================================================
-- 2. ADD sport COLUMN TO drills TABLE
-- ============================================================================
-- Default 'badminton' ensures existing records get the correct value automatically.

ALTER TABLE drills ADD COLUMN IF NOT EXISTS sport VARCHAR(30) NOT NULL DEFAULT 'badminton';

ALTER TABLE drills ADD CONSTRAINT chk_drills_sport
  CHECK (sport IN ('badminton', 'tennis', 'table_tennis', 'squash'));

-- ============================================================================
-- 3. ADD source_drill_id COLUMN TO drills TABLE (adoption lineage)
-- ============================================================================

ALTER TABLE drills ADD COLUMN IF NOT EXISTS source_drill_id VARCHAR(50)
  REFERENCES drills(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. ADD sport COLUMN TO centers TABLE
-- ============================================================================

ALTER TABLE centers ADD COLUMN IF NOT EXISTS sport VARCHAR(30);

ALTER TABLE centers ADD CONSTRAINT chk_centers_sport
  CHECK (sport IN ('badminton', 'tennis', 'table_tennis', 'squash'));

-- ============================================================================
-- 5. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_drills_sport ON drills(sport);
CREATE INDEX IF NOT EXISTS idx_drills_source_drill_id ON drills(source_drill_id);

-- Note: idx_drills_center_id already exists from add-multi-center migration.
-- Re-create only if missing (IF NOT EXISTS handles this safely).
CREATE INDEX IF NOT EXISTS idx_drills_center_id ON drills(center_id);

-- ============================================================================
-- 6. VERIFICATION
-- ============================================================================
-- Confirm all existing drills received the sport default value.

DO $$
DECLARE
  null_sport_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_sport_count FROM drills WHERE sport IS NULL;
  IF null_sport_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % drills have NULL sport after migration', null_sport_count;
  END IF;
  RAISE NOTICE 'Migration 024 verification passed: all drills have a sport value';
END $$;
