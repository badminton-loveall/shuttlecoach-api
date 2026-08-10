-- Migration: 020_add_senior_coach_id
-- Description: Add senior_coach_id column to users table for coach hierarchy.
--              Enables head coach / assistant coach relationships via self-referential FK.
-- Requirements: 5.1, 5.2, 5.3, 5.4

BEGIN;

-- ============================================================================
-- 1. ADD senior_coach_id COLUMN
-- ============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS senior_coach_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. ADD INDEX FOR QUERY PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_senior_coach_id ON users(senior_coach_id);

-- ============================================================================
-- 3. ADD CHECK CONSTRAINT TO PREVENT SELF-REFERENCE
-- ============================================================================
-- A coach cannot be their own senior coach.

DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT chk_no_self_reference
    CHECK (senior_coach_id IS NULL OR senior_coach_id != id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN users.senior_coach_id IS 'References the senior/supervising coach. NULL for top-level head coaches. FK with ON DELETE SET NULL.';

COMMIT;
