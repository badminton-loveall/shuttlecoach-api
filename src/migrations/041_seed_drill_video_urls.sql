-- Seed Drill Video URLs Migration
-- Version: 041
-- Description: Backfills a placeholder demonstration-clip URL onto source
--              drills (source_drill_id IS NULL) that don't have one yet, so
--              the video-icon-opens-modal UI has something to show while
--              admins/coaches replace it with real per-drill footage via the
--              drill catalog's video URL field. Only fills rows still NULL,
--              so it never overwrites a URL an admin has since set — safe to
--              re-run on every migration pass (see run-migrations.ts, which
--              replays every file each run rather than tracking what's new).
-- Date: 2026-09-03

UPDATE drills
SET video_url = 'https://www.youtube.com/watch?v=CC0FGFSarhQ'
WHERE video_url IS NULL
  AND source_drill_id IS NULL
  AND is_archived = false;
