-- Student Enrollment Model Migration
-- Version: 026
-- Description: Introduce per-student enrollment (batch time template + curriculum + coach +
--              start date + fee) and a durable, cross-enrollment drill training ledger.
--              Additive only — existing batches/students columns are left untouched so the
--              application can be cut over incrementally before a later migration retires them.

-- ============================================================================
-- STUDENT ENROLLMENTS TABLE
-- ============================================================================
-- One row per assignment of {batch_time_template, curriculum, coach, start_date, fee} to a
-- student. A student can have many rows over time (re-enrollment, coach change, curriculum
-- change) but at most one 'active' row at a time — history is preserved, never overwritten.

CREATE TABLE IF NOT EXISTS student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_time_template_id UUID REFERENCES batch_time_templates(id) ON DELETE SET NULL,
  curriculum_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  projected_end_date DATE,
  monthly_fee NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  is_backfilled BOOLEAN NOT NULL DEFAULT false,
  center_id UUID NOT NULL REFERENCES centers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT chk_student_enrollment_status CHECK (status IN ('active', 'ended'))
);

-- Only one active enrollment per student at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_enrollments_one_active
  ON student_enrollments(student_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_coach ON student_enrollments(coach_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_template ON student_enrollments(batch_time_template_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_curriculum ON student_enrollments(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_center ON student_enrollments(center_id);

CREATE TRIGGER update_student_enrollments_updated_at
  BEFORE UPDATE ON student_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STUDENT DRILL RECORDS TABLE
-- ============================================================================
-- A durable, per-drill training ledger. Seeded whenever a student's curriculum plan is
-- (re)generated for an enrollment — one row per drill per curriculum week. Rows are never
-- deleted or overwritten when the student's enrollment changes, so the full history of what a
-- student was assigned/trained on survives batch-timing, curriculum, and coach switches.

CREATE TABLE IF NOT EXISTS student_drill_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
  curriculum_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  drill_id VARCHAR(50) REFERENCES drills(id) ON DELETE SET NULL,
  week_number INTEGER NOT NULL,
  scheduled_start DATE,
  scheduled_end DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  level SMALLINT,
  coach_notes TEXT,
  trained_at TIMESTAMP WITH TIME ZONE,
  assessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  center_id UUID NOT NULL REFERENCES centers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT chk_student_drill_status CHECK (status IN ('scheduled', 'trained', 'skipped')),
  CONSTRAINT chk_student_drill_level CHECK (level IS NULL OR level BETWEEN 0 AND 4)
);

CREATE INDEX IF NOT EXISTS idx_student_drill_records_student ON student_drill_records(student_id);
CREATE INDEX IF NOT EXISTS idx_student_drill_records_enrollment ON student_drill_records(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_drill_records_student_status ON student_drill_records(student_id, status);
CREATE INDEX IF NOT EXISTS idx_student_drill_records_drill ON student_drill_records(drill_id);

CREATE TRIGGER update_student_drill_records_updated_at
  BEFORE UPDATE ON student_drill_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE student_enrollments IS 'Per-student assignment history of batch time template, curriculum, coach, start date, and fee. Replaces batch-wide assignment; batches.template_id/curriculum_id/assigned_coach_id remain only as defaults for new enrollments until the follow-up contraction migration.';
COMMENT ON COLUMN student_enrollments.status IS 'active (current journey) or ended (superseded by a later enrollment)';
COMMENT ON COLUMN student_enrollments.projected_end_date IS 'Auto-computed from start_date + curriculum length walked forward against the template''s session_slots cadence';
COMMENT ON COLUMN student_enrollments.is_backfilled IS 'True for rows created by the batch-to-enrollment backfill script rather than a real captured start date';

COMMENT ON TABLE student_drill_records IS 'Durable per-drill training ledger for a student, spanning every enrollment they have ever had. Never rewritten on enrollment change, so history survives batch/curriculum/coach switches.';
COMMENT ON COLUMN student_drill_records.status IS 'scheduled (not yet reached), trained (coach recorded completion), or skipped';
COMMENT ON COLUMN student_drill_records.level IS '0-4 proficiency rating, same scale as weekly_skill_scores, set when a coach marks the drill trained';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
