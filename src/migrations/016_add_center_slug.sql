-- Migration: 016_add_center_slug
-- Description: Add slug column to centers table for branded login URLs
-- Requirements: 1.1, 1.2, 1.3, 1.4

-- ============================================================================
-- 1. ADD SLUG COLUMN (nullable initially to allow backfill)
-- ============================================================================

ALTER TABLE centers ADD COLUMN IF NOT EXISTS slug VARCHAR(100);

-- ============================================================================
-- 2. BACKFILL EXISTING ROWS WITH GENERATED SLUGS
-- ============================================================================
-- Slug generation logic (mirrors src/utils/slug.ts):
--   1. Lowercase the name
--   2. Remove non-alphanumeric characters (except spaces and hyphens)
--   3. Replace spaces with hyphens
--   4. Collapse consecutive hyphens into one
--   5. Trim leading/trailing hyphens

UPDATE centers
SET slug = TRIM(BOTH '-' FROM
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        LOWER(name),
        '[^a-z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    ),
    '-{2,}', '-', 'g'
  )
)
WHERE slug IS NULL;

-- ============================================================================
-- 3. HANDLE DUPLICATE SLUGS BY APPENDING NUMERIC SUFFIX
-- ============================================================================
-- For any rows that ended up with the same slug, append -2, -3, etc.

DO $$
DECLARE
  dup_slug TEXT;
  dup_row RECORD;
  row_num INTEGER;
BEGIN
  -- Find all slugs that appear more than once
  FOR dup_slug IN
    SELECT slug FROM centers GROUP BY slug HAVING COUNT(*) > 1
  LOOP
    row_num := 1;
    FOR dup_row IN
      SELECT id FROM centers WHERE slug = dup_slug ORDER BY created_at ASC
    LOOP
      IF row_num > 1 THEN
        UPDATE centers
        SET slug = dup_slug || '-' || row_num
        WHERE id = dup_row.id;
      END IF;
      row_num := row_num + 1;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================================
-- 4. SET NOT NULL CONSTRAINT
-- ============================================================================

ALTER TABLE centers ALTER COLUMN slug SET NOT NULL;

-- ============================================================================
-- 5. ADD UNIQUE CONSTRAINT
-- ============================================================================

ALTER TABLE centers ADD CONSTRAINT centers_slug_unique UNIQUE (slug);

-- ============================================================================
-- 6. ADD CHECK CONSTRAINT FOR SLUG FORMAT
-- ============================================================================
-- Ensures slug contains only lowercase letters, numbers, and hyphens,
-- and starts/ends with an alphanumeric character.

ALTER TABLE centers ADD CONSTRAINT centers_slug_format
  CHECK (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$');

-- ============================================================================
-- 7. ADD INDEX FOR SLUG LOOKUPS
-- ============================================================================
-- Supports the public center info endpoint: GET /api/centers/:slug/info

CREATE INDEX IF NOT EXISTS idx_centers_slug ON centers(slug);

-- ============================================================================
-- 8. DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN centers.slug IS 'URL-safe unique identifier for branded login pages. Format: lowercase alphanumeric with hyphens, 3-50 chars. Used in /login/:centerSlug route.';
