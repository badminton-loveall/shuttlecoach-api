-- ShuttleCoach Database Schema Migration
-- Version: add-multi-center
-- Description: Multi-center tenancy — create centers table, add center_id FK to all
--              tenant-scoped tables, backfill existing data to a default center,
--              add ADMIN role, and verify data integrity.
-- Date: 2025-01-01

-- ============================================================================
-- SINGLE TRANSACTION — all or nothing
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ADD ADMIN TO user_role ENUM
-- ============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN';

-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL < 12.
-- If targeting PG 12+, this is safe inside BEGIN/COMMIT.
-- For PG < 12, this statement must be run separately before the transaction.

COMMIT;

-- Start a new transaction for the rest (enum value is now visible)
BEGIN;

-- ============================================================================
-- 2. CREATE CENTERS TABLE
-- ============================================================================

CREATE TABLE centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  location VARCHAR(200),
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  head_coach_id UUID,
  plan_type VARCHAR(50) DEFAULT 'basic',
  subscription_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for centers
CREATE INDEX idx_centers_is_active ON centers(is_active);
CREATE INDEX idx_centers_head_coach_id ON centers(head_coach_id);

-- Foreign key for head_coach_id (deferred so we can backfill users.center_id first)
ALTER TABLE centers
  ADD CONSTRAINT fk_centers_head_coach
  FOREIGN KEY (head_coach_id)
  REFERENCES users(id)
  ON DELETE SET NULL;

-- Trigger for updated_at (reuses existing function from 001_initial_schema.sql)
CREATE TRIGGER update_centers_updated_at
  BEFORE UPDATE ON centers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE centers IS 'Coaching centers — each represents a physical training location operating as an independent tenant';

-- ============================================================================
-- 3. INSERT DEFAULT CENTER
-- ============================================================================

INSERT INTO centers (id, name, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Center', true);

-- ============================================================================
-- 4. ASSIGN EXISTING HEAD_COACH (if exactly one exists) TO DEFAULT CENTER
-- ============================================================================

UPDATE centers
SET head_coach_id = (
  SELECT id FROM users WHERE role = 'HEAD_COACH'
)
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND (SELECT COUNT(*) FROM users WHERE role = 'HEAD_COACH') = 1;

-- ============================================================================
-- 5. ADD center_id COLUMN TO ALL TENANT-SCOPED TABLES
-- ============================================================================

-- 5a. users — stays NULLABLE (ADMIN users are platform-wide)
ALTER TABLE users
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5b. batches
ALTER TABLE batches
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5c. students
ALTER TABLE students
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5d. skill_assessments
ALTER TABLE skill_assessments
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5e. fee_records
ALTER TABLE fee_records
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5f. curriculum_plans
ALTER TABLE curriculum_plans
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5g. training_logs
ALTER TABLE training_logs
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5h. attendance_records
ALTER TABLE attendance_records
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5i. leave_requests
ALTER TABLE leave_requests
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5j. session_schedules
ALTER TABLE session_schedules
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5k. session_notes
ALTER TABLE session_notes
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- 5l. drills
ALTER TABLE drills
  ADD COLUMN center_id UUID REFERENCES centers(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. BACKFILL ALL EXISTING ROWS TO DEFAULT CENTER
-- ============================================================================

UPDATE users SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE batches SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE students SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE skill_assessments SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE fee_records SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE curriculum_plans SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE training_logs SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE attendance_records SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE leave_requests SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE session_schedules SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE session_notes SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;
UPDATE drills SET center_id = '00000000-0000-0000-0000-000000000001' WHERE center_id IS NULL;

-- ============================================================================
-- 7. SET NOT NULL CONSTRAINTS (all tables EXCEPT users)
-- ============================================================================
-- users.center_id remains NULLABLE because ADMIN users are platform-wide.

ALTER TABLE batches ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE students ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE skill_assessments ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE fee_records ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE curriculum_plans ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE training_logs ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE attendance_records ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE leave_requests ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE session_schedules ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE session_notes ALTER COLUMN center_id SET NOT NULL;
ALTER TABLE drills ALTER COLUMN center_id SET NOT NULL;

-- ============================================================================
-- 8. ADD INDEXES ON center_id FOR QUERY PERFORMANCE
-- ============================================================================

CREATE INDEX idx_users_center_id ON users(center_id);
CREATE INDEX idx_batches_center_id ON batches(center_id);
CREATE INDEX idx_students_center_id ON students(center_id);
CREATE INDEX idx_skill_assessments_center_id ON skill_assessments(center_id);
CREATE INDEX idx_fee_records_center_id ON fee_records(center_id);
CREATE INDEX idx_curriculum_plans_center_id ON curriculum_plans(center_id);
CREATE INDEX idx_training_logs_center_id ON training_logs(center_id);
CREATE INDEX idx_attendance_records_center_id ON attendance_records(center_id);
CREATE INDEX idx_leave_requests_center_id ON leave_requests(center_id);
CREATE INDEX idx_session_schedules_center_id ON session_schedules(center_id);
CREATE INDEX idx_session_notes_center_id ON session_notes(center_id);
CREATE INDEX idx_drills_center_id ON drills(center_id);

-- ============================================================================
-- 9. POST-MIGRATION VERIFICATION CHECKS
-- ============================================================================
-- These DO statements raise exceptions if any rows remain with NULL center_id
-- in tables that require NOT NULL, ensuring data integrity.

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  -- Verify batches
  SELECT COUNT(*) INTO null_count FROM batches WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in batches have NULL center_id', null_count;
  END IF;

  -- Verify students
  SELECT COUNT(*) INTO null_count FROM students WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in students have NULL center_id', null_count;
  END IF;

  -- Verify skill_assessments
  SELECT COUNT(*) INTO null_count FROM skill_assessments WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in skill_assessments have NULL center_id', null_count;
  END IF;

  -- Verify fee_records
  SELECT COUNT(*) INTO null_count FROM fee_records WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in fee_records have NULL center_id', null_count;
  END IF;

  -- Verify curriculum_plans
  SELECT COUNT(*) INTO null_count FROM curriculum_plans WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in curriculum_plans have NULL center_id', null_count;
  END IF;

  -- Verify training_logs
  SELECT COUNT(*) INTO null_count FROM training_logs WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in training_logs have NULL center_id', null_count;
  END IF;

  -- Verify attendance_records
  SELECT COUNT(*) INTO null_count FROM attendance_records WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in attendance_records have NULL center_id', null_count;
  END IF;

  -- Verify leave_requests
  SELECT COUNT(*) INTO null_count FROM leave_requests WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in leave_requests have NULL center_id', null_count;
  END IF;

  -- Verify session_schedules
  SELECT COUNT(*) INTO null_count FROM session_schedules WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in session_schedules have NULL center_id', null_count;
  END IF;

  -- Verify session_notes
  SELECT COUNT(*) INTO null_count FROM session_notes WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in session_notes have NULL center_id', null_count;
  END IF;

  -- Verify drills
  SELECT COUNT(*) INTO null_count FROM drills WHERE center_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: % rows in drills have NULL center_id', null_count;
  END IF;

  -- Summary (only reached if all checks pass)
  RAISE NOTICE 'POST-MIGRATION VERIFICATION PASSED: All tenant-scoped tables have non-NULL center_id';
END $$;

-- ============================================================================
-- 10. DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON COLUMN users.center_id IS 'FK to centers.id — NULL for ADMIN users (platform-wide)';
COMMENT ON COLUMN batches.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN students.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN skill_assessments.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN fee_records.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN curriculum_plans.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN training_logs.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN attendance_records.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN leave_requests.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN session_schedules.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN session_notes.center_id IS 'FK to centers.id — tenant isolation';
COMMENT ON COLUMN drills.center_id IS 'FK to centers.id — tenant isolation';

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
