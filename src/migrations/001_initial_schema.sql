-- ShuttleCoach Database Schema Migration
-- Version: 001
-- Description: Initial schema for badminton training management system
-- Date: 2025-01-01

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS AND TYPES
-- ============================================================================

-- Create custom types for better type safety
CREATE TYPE user_role AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'STUDENT');
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');
CREATE TYPE skill_level_type AS ENUM ('Beginner', 'Intermediate', 'Advanced', 'Professional');
CREATE TYPE fee_status_type AS ENUM ('PAID', 'PENDING', 'OVERDUE', 'WAIVED');
CREATE TYPE payment_method_type AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER');

-- ============================================================================
-- BATCHES TABLE
-- ============================================================================
-- Created first because students table has FK to batches

CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  schedule VARCHAR(100),
  assigned_coach_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for batches
CREATE INDEX idx_batches_coach ON batches(assigned_coach_id);

-- ============================================================================
-- USERS TABLE
-- ============================================================================
-- Stores authentication and profile data for coaches and students

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  profile_photo TEXT,
  specialization VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_username ON users(username);

-- Add foreign key constraint for batches.assigned_coach_id now that users table exists
ALTER TABLE batches 
  ADD CONSTRAINT fk_batches_coach 
  FOREIGN KEY (assigned_coach_id) 
  REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- STUDENTS TABLE
-- ============================================================================
-- Stores student profile and training information

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  age INTEGER,
  gender gender_type NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  guardian_name VARCHAR(100),
  guardian_phone VARCHAR(20),
  baid_number VARCHAR(50),
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  assigned_coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_photo TEXT,
  height NUMERIC(5,2),
  weight NUMERIC(5,2),
  bmi NUMERIC(4,1),
  blood_group VARCHAR(5),
  medical_conditions TEXT,
  emergency_contact TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  coach_feedback TEXT,
  skill_level skill_level_type,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for students
CREATE INDEX idx_students_batch ON students(batch_id);
CREATE INDEX idx_students_coach ON students(assigned_coach_id);
CREATE INDEX idx_students_name ON students(full_name);

-- Trigger function to compute age and BMI
CREATE OR REPLACE FUNCTION compute_student_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute age from date of birth
  NEW.age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.date_of_birth))::INTEGER;
  
  -- Compute BMI if height and weight are provided
  IF NEW.height IS NOT NULL AND NEW.weight IS NOT NULL THEN
    NEW.bmi := ROUND(NEW.weight / POWER(NEW.height/100, 2), 1);
  ELSE
    NEW.bmi := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger on INSERT and UPDATE
CREATE TRIGGER compute_student_fields_trigger
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION compute_student_fields();

-- ============================================================================
-- SKILL ASSESSMENTS TABLE
-- ============================================================================
-- Stores bi-monthly skill assessments with 60 skills across 6 categories

CREATE TABLE skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  cycle_key VARCHAR(20) NOT NULL,
  recorded_by VARCHAR(100) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scores JSONB NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  CONSTRAINT unique_student_cycle UNIQUE(student_id, cycle_key)
);

-- Indexes for skill_assessments
CREATE INDEX idx_assessments_student ON skill_assessments(student_id);
CREATE INDEX idx_assessments_cycle ON skill_assessments(cycle_key);

-- ============================================================================
-- FEE RECORDS TABLE
-- ============================================================================
-- Stores fee payment records and status tracking

CREATE TABLE fee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  month_year VARCHAR(7) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status fee_status_type NOT NULL,
  payment_method payment_method_type,
  transaction_ref VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fee_records
CREATE INDEX idx_fees_student ON fee_records(student_id);
CREATE INDEX idx_fees_status ON fee_records(status);
CREATE INDEX idx_fees_due_date ON fee_records(due_date);

-- ============================================================================
-- CURRICULUM PLANS TABLE
-- ============================================================================
-- Stores 8-week training curriculum plans for batches or individual students

CREATE TABLE curriculum_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_key VARCHAR(20) NOT NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  source_batch_plan_id UUID REFERENCES curriculum_plans(id) ON DELETE SET NULL,
  weeks JSONB NOT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Ensure plan is either for a batch OR a student, not both
  CONSTRAINT check_batch_or_student CHECK (
    (batch_id IS NOT NULL AND student_id IS NULL) OR 
    (batch_id IS NULL AND student_id IS NOT NULL)
  )
);

-- Indexes for curriculum_plans
CREATE INDEX idx_plans_batch ON curriculum_plans(batch_id);
CREATE INDEX idx_plans_student ON curriculum_plans(student_id);
CREATE INDEX idx_plans_cycle ON curriculum_plans(cycle_key);

-- ============================================================================
-- TRAINING LOGS TABLE
-- ============================================================================
-- Stores weekly training session notes from coaches

CREATE TABLE training_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 8),
  cycle_key VARCHAR(20) NOT NULL,
  session_notes TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  recorded_by VARCHAR(100) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Ensure one log per student per cycle per week
  CONSTRAINT unique_student_cycle_week UNIQUE(student_id, cycle_key, week_number)
);

-- Indexes for training_logs
CREATE INDEX idx_logs_student ON training_logs(student_id);
CREATE INDEX idx_logs_cycle ON training_logs(cycle_key);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to students table
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to fee_records table
CREATE TRIGGER update_fee_records_updated_at
  BEFORE UPDATE ON fee_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to curriculum_plans table
CREATE TRIGGER update_curriculum_plans_updated_at
  BEFORE UPDATE ON curriculum_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Authentication and profile data for coaches and students';
COMMENT ON TABLE students IS 'Student profile and training information';
COMMENT ON TABLE skill_assessments IS 'Bi-monthly skill assessments with JSONB scores (60 skills across 6 categories)';
COMMENT ON TABLE fee_records IS 'Fee payment tracking with status and transaction details';
COMMENT ON TABLE curriculum_plans IS 'Eight-week training curriculum plans for batches or individual students';
COMMENT ON TABLE training_logs IS 'Weekly training session notes recorded by coaches';
COMMENT ON TABLE batches IS 'Student batch groupings with assigned coaches';

COMMENT ON COLUMN students.age IS 'Computed from date_of_birth via trigger';
COMMENT ON COLUMN students.bmi IS 'Computed from height and weight via trigger';
COMMENT ON COLUMN skill_assessments.scores IS 'JSONB structure: { category: { skillName: score } }';
COMMENT ON COLUMN curriculum_plans.weeks IS 'JSONB array of 8 week plans with drills and objectives';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
