-- ShuttleCoach Database Schema Migration
-- Version: 012
-- Description: Create attendance, leave requests, session schedules, session notes, and curriculum week mappings tables
-- Date: 2025-01-01

-- ============================================================================
-- ATTENDANCE RECORDS TABLE
-- ============================================================================
-- Stores daily attendance records for students within batches.
-- One record per student per batch per session date (enforced by unique constraint).
-- Supports upsert semantics for idempotent submissions.

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  session_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL,
  leave_type VARCHAR(15),
  marked_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- CHECK constraints for data integrity
  CONSTRAINT chk_attendance_status CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
  CONSTRAINT chk_attendance_leave_type CHECK (leave_type IN ('PLANNED_LEAVE', 'SICK_LEAVE', 'NO_SHOW')),

  -- UNIQUE constraint: one record per student per batch per session date
  CONSTRAINT uq_attendance_student_batch_date UNIQUE (student_id, batch_id, session_date),

  -- FOREIGN KEYS
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id)
    REFERENCES students(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_attendance_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_attendance_marked_by
    FOREIGN KEY (marked_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES - attendance_records
-- ============================================================================

CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_batch ON attendance_records(batch_id);
CREATE INDEX idx_attendance_session_date ON attendance_records(session_date);
CREATE INDEX idx_attendance_batch_session_date ON attendance_records(batch_id, session_date);

-- ============================================================================
-- LEAVE REQUESTS TABLE
-- ============================================================================
-- Stores student leave requests with approval workflow.
-- Students submit requests for future dates; coaches approve or reject.

CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  requested_date DATE NOT NULL,
  leave_type VARCHAR(15) NOT NULL,
  reason TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- CHECK constraints for data integrity
  CONSTRAINT chk_leave_request_type CHECK (leave_type IN ('PLANNED_LEAVE', 'SICK_LEAVE')),
  CONSTRAINT chk_leave_request_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

  -- FOREIGN KEYS
  CONSTRAINT fk_leave_request_student
    FOREIGN KEY (student_id)
    REFERENCES students(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_leave_request_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_leave_request_reviewed_by
    FOREIGN KEY (reviewed_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES - leave_requests
-- ============================================================================

CREATE INDEX idx_leave_requests_student ON leave_requests(student_id);
CREATE INDEX idx_leave_requests_batch ON leave_requests(batch_id);
CREATE INDEX idx_leave_requests_batch_status ON leave_requests(batch_id, status);
CREATE INDEX idx_leave_requests_requested_date ON leave_requests(requested_date);

-- ============================================================================
-- SESSION SCHEDULES TABLE
-- ============================================================================
-- Stores structured session schedules for batches.
-- One schedule per batch (enforced by UNIQUE on batch_id).
-- Slots and recurrence stored as JSONB for flexible schedule definitions.

CREATE TABLE session_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  slots JSONB NOT NULL,
  recurrence JSONB NOT NULL,
  cycle_start_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- UNIQUE constraint: one schedule per batch
  CONSTRAINT uq_session_schedules_batch UNIQUE (batch_id),

  -- FOREIGN KEYS
  CONSTRAINT fk_session_schedules_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE CASCADE
);

-- ============================================================================
-- SESSION NOTES TABLE
-- ============================================================================
-- Stores coach notes for specific batch sessions.
-- One note per batch per session date (enforced by unique constraint).

CREATE TABLE session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  session_date DATE NOT NULL,
  note_text TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- UNIQUE constraint: one note per batch per session date
  CONSTRAINT uq_session_notes_batch_date UNIQUE (batch_id, session_date),

  -- FOREIGN KEYS
  CONSTRAINT fk_session_notes_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_session_notes_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
);

-- ============================================================================
-- PERFORMANCE INDEXES - session_notes
-- ============================================================================

CREATE INDEX idx_session_notes_batch ON session_notes(batch_id);
CREATE INDEX idx_session_notes_batch_date ON session_notes(batch_id, session_date);

-- ============================================================================
-- CURRICULUM WEEK MAPPINGS TABLE
-- ============================================================================
-- Maps calendar date ranges to curriculum week numbers for batches.
-- Used to override or explicitly define the mapping from dates to curriculum weeks.

CREATE TABLE curriculum_week_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  cycle_key VARCHAR(20) NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- CHECK constraints for data integrity
  CONSTRAINT chk_curriculum_week_number CHECK (week_number BETWEEN 1 AND 8),

  -- UNIQUE constraint: one mapping per batch per cycle per week
  CONSTRAINT uq_curriculum_week_mapping UNIQUE (batch_id, cycle_key, week_number),

  -- FOREIGN KEYS
  CONSTRAINT fk_curriculum_week_mapping_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE CASCADE
);

-- ============================================================================
-- PERFORMANCE INDEXES - curriculum_week_mappings
-- ============================================================================

CREATE INDEX idx_curriculum_week_mappings_batch ON curriculum_week_mappings(batch_id);
CREATE INDEX idx_curriculum_week_mappings_batch_cycle ON curriculum_week_mappings(batch_id, cycle_key);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================
-- Uses the existing update_updated_at_column() function from 001_initial_schema.sql

-- Apply trigger to attendance_records table
CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to session_schedules table
CREATE TRIGGER update_session_schedules_updated_at
  BEFORE UPDATE ON session_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to session_notes table
CREATE TRIGGER update_session_notes_updated_at
  BEFORE UPDATE ON session_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE attendance_records IS 'Daily attendance records for students within batches, one per student-batch-date';
COMMENT ON TABLE leave_requests IS 'Student leave request submissions with approval workflow';
COMMENT ON TABLE session_schedules IS 'Structured session schedules per batch with JSONB slots and recurrence patterns';
COMMENT ON TABLE session_notes IS 'Coach notes for specific batch sessions, one per batch-date';
COMMENT ON TABLE curriculum_week_mappings IS 'Maps calendar date ranges to curriculum week numbers for batch training cycles';

COMMENT ON COLUMN attendance_records.status IS 'Attendance status: PRESENT, ABSENT, or LATE';
COMMENT ON COLUMN attendance_records.leave_type IS 'Leave classification when ABSENT: PLANNED_LEAVE, SICK_LEAVE, or NO_SHOW';
COMMENT ON COLUMN leave_requests.status IS 'Review status: PENDING (default), APPROVED, or REJECTED';
COMMENT ON COLUMN leave_requests.leave_type IS 'Leave category: PLANNED_LEAVE or SICK_LEAVE';
COMMENT ON COLUMN session_schedules.slots IS 'JSONB array of SessionSlot objects: [{dayOfWeek, startTime, endTime}]';
COMMENT ON COLUMN session_schedules.recurrence IS 'JSONB recurrence pattern: {repeatEvery, repeatUnit, repeatDays, endType, endDate, occurrenceCount}';
COMMENT ON COLUMN session_schedules.cycle_start_date IS 'Start date for curriculum week computation';
COMMENT ON COLUMN curriculum_week_mappings.week_number IS 'Curriculum week within a cycle (1-8)';
COMMENT ON COLUMN curriculum_week_mappings.cycle_key IS 'Training cycle identifier, e.g. Jan-Feb 2026';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
