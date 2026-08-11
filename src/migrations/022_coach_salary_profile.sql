-- Migration: 022_coach_salary_profile
-- Description: Add extended profile columns to users table and create salary_records table

-- Add extended profile columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_details TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10,2);

-- Create salary_records table
CREATE TABLE IF NOT EXISTS salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(10,2) NOT NULL,
  salary_period VARCHAR(7) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  payment_date DATE,
  payment_method VARCHAR(20),
  center_id UUID NOT NULL REFERENCES centers(id),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_salary_coach_period UNIQUE (coach_user_id, salary_period),
  CONSTRAINT chk_salary_status CHECK (status IN ('PENDING', 'PAID'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_salary_records_coach_user_id ON salary_records(coach_user_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_center_id ON salary_records(center_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_salary_period ON salary_records(salary_period);
CREATE INDEX IF NOT EXISTS idx_salary_records_status ON salary_records(status);
