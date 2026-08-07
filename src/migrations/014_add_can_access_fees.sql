-- Migration: 014_add_can_access_fees
-- Description: Add can_access_fees boolean column to users table for per-user fee access control
-- Requirements: 1.1, 1.2, 1.3

-- Add the can_access_fees column with default false
-- Existing ASSISTANT_COACH users will default to false (no fee access)
-- The flag is ignored for ADMIN/HEAD_COACH by the middleware logic
ALTER TABLE users ADD COLUMN can_access_fees BOOLEAN NOT NULL DEFAULT false;

-- Partial index for efficient permission lookups on ASSISTANT_COACH users
-- Covers the query pattern: SELECT can_access_fees FROM users WHERE id = $1
CREATE INDEX idx_users_can_access_fees ON users (id, can_access_fees) WHERE role = 'ASSISTANT_COACH';

-- Document the column purpose
COMMENT ON COLUMN users.can_access_fees IS 'Controls whether an ASSISTANT_COACH can view and manage fee data. HEAD_COACH and ADMIN always have access regardless of this flag value.';
