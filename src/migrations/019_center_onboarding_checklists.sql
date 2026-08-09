-- Migration: 019_center_onboarding_checklists.sql
-- Feature: Center Onboarding Checklist
-- Requirements: 2.1, 2.2

BEGIN;

-- Center onboarding checklists table
CREATE TABLE IF NOT EXISTS center_onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL UNIQUE REFERENCES centers(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[
    {"key": "add_coach", "completed": false, "completedAt": null},
    {"key": "add_students", "completed": false, "completedAt": null},
    {"key": "setup_curriculum", "completed": false, "completedAt": null},
    {"key": "create_batch_templates", "completed": false, "completedAt": null},
    {"key": "create_batches", "completed": false, "completedAt": null},
    {"key": "assign_students", "completed": false, "completedAt": null}
  ]',
  dismissed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on center_id (enforced by UNIQUE constraint above, explicit index for clarity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coc_center_id ON center_onboarding_checklists(center_id);

COMMIT;
