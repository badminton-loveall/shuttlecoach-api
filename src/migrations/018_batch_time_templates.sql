-- Migration: 018_batch_time_templates.sql
-- Feature: Batch Time Templates, Session Slots, and Batch Coach Assignments
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6

BEGIN;

-- 1. batch_time_templates table
CREATE TABLE IF NOT EXISTS batch_time_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_btt_center_id ON batch_time_templates(center_id);
CREATE INDEX IF NOT EXISTS idx_btt_center_active ON batch_time_templates(center_id, is_archived);

-- 2. session_slots table
CREATE TABLE IF NOT EXISTS session_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES batch_time_templates(id) ON DELETE CASCADE,
  day_of_week VARCHAR(3) NOT NULL CHECK (day_of_week IN ('Mon','Tue','Wed','Thu','Fri','Sat','Sun')),
  start_time TIME NOT NULL,
  duration_hours INTEGER NOT NULL CHECK (duration_hours BETWEEN 1 AND 4)
);

CREATE INDEX IF NOT EXISTS idx_ss_template_id ON session_slots(template_id);

-- 3. batch_coach_assignments table
CREATE TABLE IF NOT EXISTS batch_coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES users(id),
  role VARCHAR(20) NOT NULL CHECK (role IN ('head_coach', 'assistant_coach')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT bca_unique_coach_per_batch UNIQUE (batch_id, coach_id)
);

-- Partial unique index: only one head_coach per batch
CREATE UNIQUE INDEX IF NOT EXISTS idx_bca_one_head_per_batch
  ON batch_coach_assignments(batch_id) WHERE role = 'head_coach';

CREATE INDEX IF NOT EXISTS idx_bca_batch_id ON batch_coach_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_bca_coach_id ON batch_coach_assignments(coach_id);

-- 4. Add template_id to batches
ALTER TABLE batches ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES batch_time_templates(id);

-- 5. Add assigned_coach_id to students (for per-student coach assignment within batch)
ALTER TABLE students ADD COLUMN IF NOT EXISTS assigned_coach_id UUID REFERENCES users(id);

COMMIT;
