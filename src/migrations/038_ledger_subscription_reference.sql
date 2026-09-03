-- Ledger Subscription Reference Migration
-- Version: 038
-- Description: Adds SUBSCRIPTION to ledger_entries.reference_type so a
--              center's marketplace subscription payments (Account/Drill Pack/
--              Accounting/capacity purchases) show up in the same unified
--              ledger as FEE and SALARY entries — no new financial table.
--              A subscription payment is money leaving the center's account,
--              so it is recorded as a DEBIT, same direction as a coach salary.
--              The original CHECK constraint on reference_type was created
--              inline (migration 021) so its auto-generated name isn't
--              guaranteed; this finds it dynamically instead of assuming a name.
-- Date: 2026-09-03

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'ledger_entries'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%reference_type%IN%'
  LOOP
    EXECUTE format('ALTER TABLE ledger_entries DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- The column itself was VARCHAR(10), sized for FEE/SALARY/MANUAL — too narrow
-- for 'SUBSCRIPTION' (12 chars). Widen it before re-adding the check.
ALTER TABLE ledger_entries ALTER COLUMN reference_type TYPE VARCHAR(20);

ALTER TABLE ledger_entries ADD CONSTRAINT ledger_entries_reference_type_check
  CHECK (reference_type IN ('FEE', 'SALARY', 'MANUAL', 'SUBSCRIPTION'));
