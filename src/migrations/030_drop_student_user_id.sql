-- Migration: 030_drop_student_user_id
-- Description: Remove students.user_id. A student's login account (users row)
-- is now created with the SAME id as the student row itself, so a separate
-- linking column is redundant — every STUDENT-scoped query already treats
-- req.user.id as the student_id directly.

ALTER TABLE students DROP COLUMN IF EXISTS user_id;
