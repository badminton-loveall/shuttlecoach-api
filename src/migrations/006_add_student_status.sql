-- ShuttleCoach Database Schema Migration
-- Version: 006
-- Description: Add status and archived_at columns to students table for soft-delete support
-- Date: 2025-01-01

-- ============================================================================
-- ADD STATUS AND ARCHIVED_AT COLUMNS TO STUDENTS TABLE
-- ============================================================================

ALTER TABLE students
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN archived_at TIMESTAMP;

-- Index for filtering by status
CREATE INDEX idx_students_status ON students(status);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
