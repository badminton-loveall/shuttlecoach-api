-- Drill Pack Enable/Disable Toggle Migration
-- Version: 033
-- Description: Lets a center enable/disable a Drill Set it owns or has adopted
--              (hiding its drills from future assignment while leaving past
--              assignments untouched), and adds the equivalent toggle for the
--              synthetic "Official Drill Pack" (the admin-curated global drill
--              catalog, which is not a drill_sets row).
-- Date: 2026-09-02

ALTER TABLE drill_sets ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE centers ADD COLUMN IF NOT EXISTS official_pack_enabled BOOLEAN NOT NULL DEFAULT true;
