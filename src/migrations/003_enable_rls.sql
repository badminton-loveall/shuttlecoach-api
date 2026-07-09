-- Migration: Enable Row Level Security
-- Version: 003
-- Description: Enable RLS on all public tables and add service-role bypass policies.
--
-- Context: The app uses a dedicated Express API (not Supabase client libraries).
-- All database access goes through a single server-side connection using the
-- DATABASE_URL (postgres/service role). RLS policies here allow that role full
-- access while blocking any accidental direct client access.
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_assessments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_logs      ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES
-- ============================================================================
-- The Express API connects as the database owner / service role.
-- These policies grant that role unrestricted access to all rows.
-- Supabase's `service_role` key bypasses RLS automatically; the policies
-- below also cover direct postgres superuser connections (e.g. pgbouncer URL).

-- users
CREATE POLICY "service_role_all_users"
  ON public.users
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- batches
CREATE POLICY "service_role_all_batches"
  ON public.batches
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- students
CREATE POLICY "service_role_all_students"
  ON public.students
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- skill_assessments
CREATE POLICY "service_role_all_skill_assessments"
  ON public.skill_assessments
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- fee_records
CREATE POLICY "service_role_all_fee_records"
  ON public.fee_records
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- curriculum_plans
CREATE POLICY "service_role_all_curriculum_plans"
  ON public.curriculum_plans
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- training_logs
CREATE POLICY "service_role_all_training_logs"
  ON public.training_logs
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
