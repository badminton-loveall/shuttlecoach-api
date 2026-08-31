-- Migration: 029_student_login
-- Description: Link students to a login-capable users row (role STUDENT) so
-- that new student enrollment can create real login credentials, mirroring
-- how coaches already get a users row + membership on creation.

ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
