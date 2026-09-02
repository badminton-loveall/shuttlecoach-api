-- Migration: Enable Row Level Security on tables added after 003_enable_rls.sql
-- Version: 032
-- Description: Fixes Supabase Security Advisor "RLS Disabled in Public" errors for
-- tables created in later migrations that were never added to 003_enable_rls.sql.
--
-- Context: Same as 003_enable_rls.sql — the app uses a dedicated Express API (not
-- Supabase client libraries). All database access goes through a single server-side
-- connection using DATABASE_URL (postgres/service role). RLS policies here allow
-- that role full access while blocking any accidental direct client access.
-- ============================================================================

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE public.student_enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_drill_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drills                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_skill_scores     ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICE ROLE BYPASS POLICIES
-- ============================================================================

-- student_enrollments
CREATE POLICY "service_role_all_student_enrollments"
  ON public.student_enrollments
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- student_drill_records
CREATE POLICY "service_role_all_student_drill_records"
  ON public.student_drill_records
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- password_reset_tokens
CREATE POLICY "service_role_all_password_reset_tokens"
  ON public.password_reset_tokens
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- drills
CREATE POLICY "service_role_all_drills"
  ON public.drills
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- weekly_skill_scores
CREATE POLICY "service_role_all_weekly_skill_scores"
  ON public.weekly_skill_scores
  FOR ALL
  TO postgres, service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
