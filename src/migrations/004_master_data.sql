-- Master Data Management Migration
-- Version: 004
-- Description: Create drills table and extend batches table with soft-delete support

-- ============================================================================
-- DRILLS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS drills (
  id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drills_category ON drills(category);
CREATE INDEX IF NOT EXISTS idx_drills_archived ON drills(is_archived);

-- ============================================================================
-- EXTEND BATCHES TABLE
-- ============================================================================

ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_batches_archived ON batches(is_archived);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
-- Reuse the existing update_updated_at_column() function from 001_initial_schema.sql

CREATE TRIGGER update_drills_updated_at
  BEFORE UPDATE ON drills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
