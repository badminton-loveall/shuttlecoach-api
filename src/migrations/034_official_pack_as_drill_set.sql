-- Official Pack As A Real Drill Set Migration
-- Version: 034
-- Description: Converts the synthetic "Official Drill Pack" (previously a
--              client-side aggregate of the global drill catalog, wired to
--              a one-off centers.official_pack_enabled flag) into a real
--              drill_sets row named "Badminton Drills Pack", owned by a
--              dedicated system/platform center. From this point on the
--              official catalog is adopted, enabled, and disabled through
--              the exact same drill_sets machinery as any coach-authored
--              pack — no special-casing needed in the app.
-- Date: 2026-09-02

-- ============================================================================
-- 1. Mark centers that are platform infrastructure, not real coaching centers
-- ============================================================================

ALTER TABLE centers ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 2. Mark drill_sets that are admin-curated/pre-approved (vs coach-submitted)
-- ============================================================================

ALTER TABLE drill_sets ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 3. Superseded by per-set is_enabled now that the official pack is a real
--    drill_sets row — the whole-center flag from migration 033 is no longer
--    read anywhere in the app.
-- ============================================================================

ALTER TABLE centers DROP COLUMN IF EXISTS official_pack_enabled;

-- ============================================================================
-- 4. The system center that owns the official catalog
-- ============================================================================

INSERT INTO centers (id, name, slug, is_active, sport, marketplace_enabled, is_system)
VALUES ('00000000-0000-0000-0000-000000000001', 'LoveAll Platform', 'loveall-platform', true, 'badminton', true, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. The Badminton Drills Pack set: pre-published, one category per distinct
--    existing global-drill category, every existing global drill linked in.
-- ============================================================================

DO $$
DECLARE
  admin_id UUID;
  official_set_id VARCHAR(50) := 'official-badminton-pack';
  cat RECORD;
  new_cat_id VARCHAR(50);
  cat_index INTEGER := 0;
BEGIN
  SELECT id INTO admin_id FROM users WHERE role = 'ADMIN' ORDER BY created_at ASC LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No ADMIN user found — cannot seed the official drill pack owner';
  END IF;

  INSERT INTO drill_sets (
    id, name, description, sport, center_id, created_by,
    status, submitted_at, reviewed_by, reviewed_at, is_official
  )
  VALUES (
    official_set_id,
    'Badminton Drills Pack',
    'The complete official badminton drill catalog, ready for any center to adopt.',
    'badminton',
    '00000000-0000-0000-0000-000000000001',
    admin_id,
    'published',
    NOW(),
    admin_id,
    NOW(),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  FOR cat IN
    SELECT DISTINCT category FROM drills WHERE center_id IS NULL AND is_archived = false
  LOOP
    new_cat_id := NULL;

    INSERT INTO drill_set_categories (set_id, name, sort_order)
    SELECT official_set_id, cat.category, cat_index
    WHERE NOT EXISTS (
      SELECT 1 FROM drill_set_categories WHERE set_id = official_set_id AND name = cat.category
    )
    RETURNING id INTO new_cat_id;

    IF new_cat_id IS NULL THEN
      SELECT id INTO new_cat_id FROM drill_set_categories
      WHERE set_id = official_set_id AND name = cat.category;
    END IF;

    INSERT INTO drill_set_category_drills (set_category_id, drill_id)
    SELECT new_cat_id, d.id
    FROM drills d
    WHERE d.center_id IS NULL AND d.is_archived = false AND d.category = cat.category
    ON CONFLICT (set_category_id, drill_id) DO NOTHING;

    cat_index := cat_index + 1;
  END LOOP;
END $$;
