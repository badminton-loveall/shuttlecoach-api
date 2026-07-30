-- ShuttleCoach Database Schema Migration
-- Version: 007
-- Description: Create weekly_skill_scores table for per-week, per-skill student scoring
-- Date: 2025-01-01

-- ============================================================================
-- WEEKLY SKILL SCORES TABLE
-- ============================================================================
-- Stores weekly skill scores (0-4) for each student across 62 badminton skills.
-- Enables heatmap visualization and timeline drill-down in the Skill Progression Tracker.

CREATE TABLE weekly_skill_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  week_number INTEGER NOT NULL,
  cycle_key VARCHAR(20) NOT NULL,
  skill_id VARCHAR(50) NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  score INTEGER NOT NULL,
  recorded_by VARCHAR(100) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- CHECK constraints for data integrity
  CONSTRAINT chk_week_number CHECK (week_number BETWEEN 1 AND 8),
  CONSTRAINT chk_score CHECK (score BETWEEN 0 AND 4),

  -- FOREIGN KEY with CASCADE delete
  CONSTRAINT fk_weekly_skill_scores_student
    FOREIGN KEY (student_id)
    REFERENCES students(id)
    ON DELETE CASCADE
);

-- ============================================================================
-- UNIQUE INDEX: one score per student per cycle per week per skill
-- ============================================================================

CREATE UNIQUE INDEX idx_weekly_skill_scores_unique
  ON weekly_skill_scores(student_id, cycle_key, week_number, skill_id);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index on student_id for efficient student-level queries
CREATE INDEX idx_weekly_skill_scores_student
  ON weekly_skill_scores(student_id);

-- Composite index on (student_id, cycle_key) for efficient cycle-filtered queries
CREATE INDEX idx_weekly_skill_scores_student_cycle
  ON weekly_skill_scores(student_id, cycle_key);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT TIMESTAMP
-- ============================================================================

CREATE TRIGGER update_weekly_skill_scores_updated_at
  BEFORE UPDATE ON weekly_skill_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE weekly_skill_scores IS 'Per-week skill scores (0-4) for student progression tracking across 62 badminton skills in 5 categories';
COMMENT ON COLUMN weekly_skill_scores.week_number IS 'Week within the training cycle (1-8)';
COMMENT ON COLUMN weekly_skill_scores.cycle_key IS 'Training cycle identifier, e.g. Jan-Feb 2026';
COMMENT ON COLUMN weekly_skill_scores.skill_id IS 'Unique skill identifier from SKILL_CATALOG (kebab-case)';
COMMENT ON COLUMN weekly_skill_scores.score IS 'Skill proficiency: 0=Dont Know, 1=Beginner, 2=Intermediate, 3=Advanced, 4=Pro';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
