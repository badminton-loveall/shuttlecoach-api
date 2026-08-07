-- Migration: 017_user_center_memberships
-- Description: Create user_center_memberships and slug_change_requests tables,
--              populate memberships from existing users, make users.center_id nullable.
-- Requirements: 1.1, 1.2, 1.4, 6.5

BEGIN;

-- ============================================================================
-- 1. CREATE user_center_memberships TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_center_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('HEAD_COACH', 'ASSISTANT_COACH', 'STUDENT')),
  can_access_fees BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ADD UNIQUE CONSTRAINT AND INDEXES
-- ============================================================================

-- A user can only hold one instance of a given role at a given center
ALTER TABLE user_center_memberships
  ADD CONSTRAINT ucm_user_center_role_unique UNIQUE (user_id, center_id, role);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ucm_user_id ON user_center_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_ucm_center_id ON user_center_memberships(center_id);
CREATE INDEX IF NOT EXISTS idx_ucm_user_center ON user_center_memberships(user_id, center_id);

-- ============================================================================
-- 3. CREATE TRIGGER TO ENFORCE MAX 20 MEMBERSHIPS PER USER
-- ============================================================================

CREATE OR REPLACE FUNCTION check_membership_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM user_center_memberships WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'User cannot have more than 20 center memberships';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it already exists to make migration idempotent
DROP TRIGGER IF EXISTS trg_check_membership_limit ON user_center_memberships;

CREATE TRIGGER trg_check_membership_limit
  BEFORE INSERT ON user_center_memberships
  FOR EACH ROW
  EXECUTE FUNCTION check_membership_limit();

-- ============================================================================
-- 4. CREATE slug_change_requests TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS slug_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id),
  requested_slug VARCHAR(50) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by UUID NOT NULL REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for slug change request queries
CREATE INDEX IF NOT EXISTS idx_scr_center_status ON slug_change_requests(center_id, status);
CREATE INDEX IF NOT EXISTS idx_scr_status ON slug_change_requests(status);

-- ============================================================================
-- 5. POPULATE user_center_memberships FROM EXISTING USERS
-- ============================================================================
-- Backfill memberships for all non-ADMIN users who have a center_id assigned.
-- Uses ON CONFLICT DO NOTHING so this is safe to run multiple times.

INSERT INTO user_center_memberships (user_id, center_id, role, can_access_fees, created_at)
SELECT id, center_id, role::VARCHAR(20), COALESCE(can_access_fees, false), created_at
FROM users
WHERE role != 'ADMIN' AND center_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. MAKE users.center_id NULLABLE
-- ============================================================================
-- After backfill, center_id is no longer the authoritative source for membership.
-- Making it nullable allows ADMIN users and future multi-center users to have NULL.

ALTER TABLE users ALTER COLUMN center_id DROP NOT NULL;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_center_memberships IS 'Maps users to centers with specific roles. A user can belong to multiple centers with different roles (max 20 total).';
COMMENT ON TABLE slug_change_requests IS 'Tracks head-coach requests to change their center slug. Requires admin approval.';

COMMIT;
