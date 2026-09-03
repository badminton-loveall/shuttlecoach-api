-- Drill Video Fields Migration
-- Version: 037
-- Description: Adds a demonstration-clip field to drills, populated on SOURCE
--              drills only (center_id IS NULL, or any original a coach
--              authored) by convention — the adoptSet copy INSERT in
--              src/controllers/drillSets.ts uses an explicit column list that
--              does not include these columns, so an adopted copy never
--              carries a stale video link. Video access for a copy is instead
--              resolved live at read time (see src/controllers/marketplace.ts),
--              by joining the copy's source_drill_id back to this row and
--              checking the requesting center's active subscription — so
--              access is revoked immediately if the subscription lapses,
--              with nothing to clean up on the copy itself.
-- Date: 2026-09-03

ALTER TABLE drills ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER;

ALTER TABLE drills ADD CONSTRAINT chk_drills_video_duration
  CHECK (video_duration_seconds IS NULL OR video_duration_seconds > 0);
