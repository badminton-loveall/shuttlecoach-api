-- Subscription Requests Migration
-- Version: 039
-- Description: Lets a coach self-serve on the marketplace: a PENDING row is
--              created when they request a paid item (awaiting admin
--              approval — same table, no new request entity), while a free
--              (price = 0) item skips straight to ACTIVE with no admin step.
--              REJECTED covers a declined request. Existing ACTIVE/EXPIRED/
--              CANCELLED behavior and the admin-direct-activate flow are
--              unchanged.
-- Date: 2026-09-03

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'center_subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%IN%'
  LOOP
    EXECUTE format('ALTER TABLE center_subscriptions DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE center_subscriptions ADD CONSTRAINT chk_center_subscriptions_status
  CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING', 'REJECTED'));

-- Prevents spamming duplicate requests for the same item while one is
-- already awaiting approval (mirrors the existing ACTIVE-only uniqueness).
CREATE UNIQUE INDEX IF NOT EXISTS idx_center_sub_pending
  ON center_subscriptions(center_id, marketplace_item_id) WHERE status = 'PENDING';
