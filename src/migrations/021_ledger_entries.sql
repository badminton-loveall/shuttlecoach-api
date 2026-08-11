-- Migration: 021_ledger_entries
-- Description: Create ledger_entries table for center-level financial ledger.
--              Tracks fee payments (credits) and salary disbursements (debits)
--              with support for manual entries and reversal entries.
-- Requirements: 3.1, 3.2, 3.3, 3.4, 3.5

BEGIN;

-- ============================================================================
-- 1. CREATE ledger_entries TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id),
  entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('CREDIT', 'DEBIT')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference_type VARCHAR(10) NOT NULL CHECK (reference_type IN ('FEE', 'SALARY', 'MANUAL')),
  reference_id UUID,
  person_id UUID,
  person_name VARCHAR(200),
  payment_method VARCHAR(20),
  category VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ADD INDEXES FOR QUERY PERFORMANCE
-- ============================================================================

-- Time-range queries (month, quarter, financial year, custom date range)
CREATE INDEX IF NOT EXISTS idx_ledger_entries_center_date
  ON ledger_entries(center_id, transaction_date);

-- Person filtering (student or coach)
CREATE INDEX IF NOT EXISTS idx_ledger_entries_center_person
  ON ledger_entries(center_id, person_id);

-- Duplicate detection and reference lookups
CREATE INDEX IF NOT EXISTS idx_ledger_entries_reference
  ON ledger_entries(center_id, reference_type, reference_id);

-- Ordering tiebreaker (chronological within same transaction_date)
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at
  ON ledger_entries(center_id, created_at);

-- ============================================================================
-- 3. ADD UNIQUE CONSTRAINT FOR DUPLICATE PREVENTION
-- ============================================================================
-- Prevents duplicate auto-generated entries for the same source record.
-- Manual entries are excluded since multiple manual entries can share the same
-- reference characteristics.

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_entries_ref
  ON ledger_entries(center_id, reference_type, reference_id, entry_type)
  WHERE reference_type != 'MANUAL';

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE ledger_entries IS 'Center-level financial ledger tracking all monetary transactions. Entries are immutable — corrections use reversal entries.';

COMMIT;
