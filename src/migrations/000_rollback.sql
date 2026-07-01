-- ShuttleCoach Database Rollback
-- Version: 000
-- Description: Drops all tables and types (DESTRUCTIVE - USE WITH CAUTION)
-- Date: 2025-01-01

-- ============================================================================
-- WARNING: THIS SCRIPT WILL DELETE ALL DATA
-- ============================================================================

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS training_logs CASCADE;
DROP TABLE IF EXISTS curriculum_plans CASCADE;
DROP TABLE IF EXISTS fee_records CASCADE;
DROP TABLE IF EXISTS skill_assessments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS payment_method_type;
DROP TYPE IF EXISTS fee_status_type;
DROP TYPE IF EXISTS skill_level_type;
DROP TYPE IF EXISTS gender_type;
DROP TYPE IF EXISTS user_role;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop extension if no longer needed (be careful in shared databases)
-- DROP EXTENSION IF EXISTS "pgcrypto";

-- Confirmation message
DO $$
BEGIN
  RAISE NOTICE 'All ShuttleCoach tables, types, and functions have been dropped.';
END $$;
