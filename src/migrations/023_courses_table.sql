-- Curriculum Course Management Migration
-- Version: 023
-- Description: Create courses table and add curriculum_id to batches

-- ============================================================================
-- COURSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  coach_id UUID NOT NULL REFERENCES users(id),
  weeks JSONB NOT NULL DEFAULT '[]'::jsonb,
  center_id UUID REFERENCES centers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_course_name_per_coach UNIQUE(name, coach_id)
);

-- Indexes for courses
CREATE INDEX IF NOT EXISTS idx_courses_coach_id ON courses(coach_id);
CREATE INDEX IF NOT EXISTS idx_courses_center_id ON courses(center_id);

-- ============================================================================
-- EXTEND BATCHES TABLE
-- ============================================================================

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS curriculum_id UUID REFERENCES courses(id) ON DELETE SET NULL;

-- ============================================================================
-- UPDATE TRIGGER
-- ============================================================================
-- Reuse the existing update_updated_at_column() function from 001_initial_schema.sql

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
