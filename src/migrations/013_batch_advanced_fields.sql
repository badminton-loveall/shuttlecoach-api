-- Migration: Add advanced configuration fields to batches table
-- These fields support the expanded batch management modal

ALTER TABLE batches ADD COLUMN IF NOT EXISTS capacity INTEGER;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS skill_level VARCHAR(50);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS days_of_week TEXT[];
ALTER TABLE batches ADD COLUMN IF NOT EXISTS start_time VARCHAR(10);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS end_time VARCHAR(10);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
