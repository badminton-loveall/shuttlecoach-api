-- Drill Packs Are a One-Time Purchase Migration
-- Version: 040
-- Description: A drill pack is a single, one-time purchase — not a recurring
--              subscription like Accounting or a capacity add-on. The
--              underlying mechanism stays the same (a center_subscriptions
--              row records who bought it and what they paid — that part is
--              shared plumbing, not a recurring charge), but billing_period
--              now says so explicitly, and the admin catalog form no longer
--              lets a drill pack be billed monthly.
-- Date: 2026-09-03

UPDATE marketplace_items SET billing_period = 'ONE_TIME' WHERE category = 'DRILL_PACK';
