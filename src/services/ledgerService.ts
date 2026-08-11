import { query } from '../config/database';
import { LedgerEntryType, LedgerReferenceType, LedgerEntry, LedgerQueryFilters, LedgerQueryResult } from '../types';
import { getMonthRange, getQuarterRange, getFinancialYearRange } from '../utils/ledgerDateUtils';

// ============================================================
// Ledger Service — Entry Creation and Duplicate Prevention
// ============================================================

export interface FeeRecordForLedger {
  id: string;
  studentId: string;
  amount: number;
  paidDate: string;       // YYYY-MM-DD
  monthYear: string;      // e.g., "2025-04"
  paymentMethod?: string;
}

export interface SalaryRecordForLedger {
  id: string;
  coachUserId: string;
  amount: number;
  paymentDate: string;    // YYYY-MM-DD
  salaryPeriod: string;   // e.g., "April 2025"
  paymentMethod?: string;
}

/**
 * Checks if a ledger entry already exists for the given reference.
 * Used to prevent duplicate entries for the same fee/salary record.
 */
export async function hasDuplicateEntry(
  referenceType: LedgerReferenceType,
  referenceId: string,
  entryType: LedgerEntryType,
  centerId: string
): Promise<boolean> {
  const result = await query(
    `SELECT 1 FROM ledger_entries
     WHERE center_id = $1 AND reference_type = $2 AND reference_id = $3 AND entry_type = $4
     LIMIT 1`,
    [centerId, referenceType, referenceId, entryType]
  );
  return result.rows.length > 0;
}

/**
 * Creates a CREDIT ledger entry from a paid fee record.
 * Returns null if an entry already exists for this fee (idempotent).
 */
export async function createCreditEntry(
  feeRecord: FeeRecordForLedger,
  studentName: string,
  centerId: string
): Promise<LedgerEntry | null> {
  const exists = await hasDuplicateEntry(
    LedgerReferenceType.FEE,
    feeRecord.id,
    LedgerEntryType.CREDIT,
    centerId
  );
  if (exists) return null;

  const description = `Fee payment - ${studentName} (${feeRecord.monthYear})`;

  const result = await query(
    `INSERT INTO ledger_entries
       (center_id, entry_type, amount, transaction_date, description,
        reference_type, reference_id, person_id, person_name, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      centerId,
      LedgerEntryType.CREDIT,
      feeRecord.amount,
      feeRecord.paidDate,
      description,
      LedgerReferenceType.FEE,
      feeRecord.id,
      feeRecord.studentId,
      studentName,
      feeRecord.paymentMethod || null,
    ]
  );

  return mapRowToLedgerEntry(result.rows[0]);
}

/**
 * Creates a DEBIT ledger entry from a paid salary record.
 * Returns null if an entry already exists for this salary (idempotent).
 */
export async function createDebitEntry(
  salaryRecord: SalaryRecordForLedger,
  coachName: string,
  centerId: string
): Promise<LedgerEntry | null> {
  const exists = await hasDuplicateEntry(
    LedgerReferenceType.SALARY,
    salaryRecord.id,
    LedgerEntryType.DEBIT,
    centerId
  );
  if (exists) return null;

  const description = `Salary payment - ${coachName} (${salaryRecord.salaryPeriod})`;

  const result = await query(
    `INSERT INTO ledger_entries
       (center_id, entry_type, amount, transaction_date, description,
        reference_type, reference_id, person_id, person_name, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      centerId,
      LedgerEntryType.DEBIT,
      salaryRecord.amount,
      salaryRecord.paymentDate,
      description,
      LedgerReferenceType.SALARY,
      salaryRecord.id,
      salaryRecord.coachUserId,
      coachName,
      salaryRecord.paymentMethod || null,
    ]
  );

  return mapRowToLedgerEntry(result.rows[0]);
}

/**
 * Maps a database row to the LedgerEntry interface.
 */
export function mapRowToLedgerEntry(row: any): LedgerEntry {
  return {
    id: row.id,
    centerId: row.center_id,
    entryType: row.entry_type as LedgerEntryType,
    amount: parseFloat(row.amount),
    transactionDate: row.transaction_date,
    description: row.description,
    referenceType: row.reference_type as LedgerReferenceType,
    referenceId: row.reference_id || null,
    personId: row.person_id || null,
    personName: row.person_name || null,
    paymentMethod: row.payment_method || null,
    category: row.category || null,
    createdAt: row.created_at,
  };
}

/**
 * Creates a manual ledger entry for miscellaneous income or expense.
 * @param params - The manual entry parameters
 * @param centerId - Center ID for scoping
 * @returns The created entry
 * @throws Error if amount <= 0 or description is empty
 */
export async function createManualEntry(
  params: {
    entryType: LedgerEntryType;
    amount: number;
    transactionDate: string;
    description: string;
    category?: string;
    personId?: string;
    personName?: string;
    paymentMethod?: string;
  },
  centerId: string
): Promise<LedgerEntry> {
  if (params.amount <= 0) {
    throw new Error('Amount must be greater than zero');
  }
  if (!params.description || !params.description.trim()) {
    throw new Error('Description is required');
  }

  const result = await query(
    `INSERT INTO ledger_entries
       (center_id, entry_type, amount, transaction_date, description,
        reference_type, reference_id, person_id, person_name, payment_method, category)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      centerId,
      params.entryType,
      params.amount,
      params.transactionDate,
      params.description.trim(),
      LedgerReferenceType.MANUAL,
      null, // no reference_id for manual entries
      params.personId || null,
      params.personName || null,
      params.paymentMethod || null,
      params.category || null,
    ]
  );

  return mapRowToLedgerEntry(result.rows[0]);
}

/**
 * Creates a reversal ledger entry for a previously recorded payment.
 * Fee reversals create a DEBIT (money returned), salary reversals create a CREDIT (expense reversed).
 * @param originalReferenceType - The type of the original entry (FEE or SALARY)
 * @param originalReferenceId - The reference_id of the original entry (fee or salary record ID)
 * @param centerId - Center ID for scoping
 * @returns The created reversal entry, or null if original entry not found
 */
export async function createReversalEntry(
  originalReferenceType: LedgerReferenceType,
  originalReferenceId: string,
  centerId: string
): Promise<LedgerEntry | null> {
  // Find the original entry
  const originalResult = await query(
    `SELECT * FROM ledger_entries
     WHERE center_id = $1 AND reference_type = $2 AND reference_id = $3
     ORDER BY created_at DESC LIMIT 1`,
    [centerId, originalReferenceType, originalReferenceId]
  );

  if (originalResult.rows.length === 0) return null;

  const original = originalResult.rows[0];

  // Determine reversal type (opposite of original)
  const reversalType = original.entry_type === 'CREDIT'
    ? LedgerEntryType.DEBIT
    : LedgerEntryType.CREDIT;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const description = `Reversal - ${original.description}`;

  const result = await query(
    `INSERT INTO ledger_entries
       (center_id, entry_type, amount, transaction_date, description,
        reference_type, reference_id, person_id, person_name, payment_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      centerId,
      reversalType,
      original.amount,
      today,
      description,
      LedgerReferenceType.MANUAL, // reversal uses MANUAL to avoid unique constraint conflicts
      original.id, // reference_id points to the original ledger entry
      original.person_id,
      original.person_name,
      original.payment_method,
    ]
  );

  return mapRowToLedgerEntry(result.rows[0]);
}

// ============================================================
// Ledger Service — Query and Balance Computation
// ============================================================

/**
 * Resolves the date range from the provided filters.
 * Priority: month > quarter > financialYear > fromDate/toDate > current month
 */
function resolveDateRange(filters: LedgerQueryFilters): { start: string; end: string } {
  if (filters.month) {
    return getMonthRange(filters.month);
  }

  if (filters.quarter && filters.financialYear) {
    return getQuarterRange(filters.quarter, filters.financialYear);
  }

  if (filters.financialYear) {
    return getFinancialYearRange(filters.financialYear);
  }

  if (filters.fromDate && filters.toDate) {
    return { start: filters.fromDate, end: filters.toDate };
  }

  // Default to current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return getMonthRange(currentMonth);
}

/**
 * Queries ledger entries with optional filters, computes running balance and summary.
 * Filters: time period (month, quarter, financialYear, fromDate/toDate),
 *          person (studentId for CREDIT entries, coachId for DEBIT entries).
 * All queries are scoped to center_id.
 */
export async function queryLedger(
  filters: LedgerQueryFilters,
  centerId: string
): Promise<LedgerQueryResult> {
  const { start, end } = resolveDateRange(filters);

  // Build dynamic WHERE conditions and parameters
  const baseParams: any[] = [centerId, start, end];
  let paramIndex = 4; // next param index after $1, $2, $3
  const additionalConditions: string[] = [];

  if (filters.studentId) {
    additionalConditions.push(`le.entry_type = 'CREDIT' AND le.person_id = $${paramIndex}`);
    baseParams.push(filters.studentId);
    paramIndex++;
  } else if (filters.coachId) {
    additionalConditions.push(`le.entry_type = 'DEBIT' AND le.person_id = $${paramIndex}`);
    baseParams.push(filters.coachId);
    paramIndex++;
  }

  const additionalWhere = additionalConditions.length > 0
    ? ' AND ' + additionalConditions.join(' AND ')
    : '';

  // --- Opening balance query ---
  // Net of all entries before the filter period start date, with same person filters
  const openingBalanceParams: any[] = [centerId, start];
  let obParamIndex = 3;
  const obAdditionalConditions: string[] = [];

  if (filters.studentId) {
    obAdditionalConditions.push(`entry_type = 'CREDIT' AND person_id = $${obParamIndex}`);
    openingBalanceParams.push(filters.studentId);
    obParamIndex++;
  } else if (filters.coachId) {
    obAdditionalConditions.push(`entry_type = 'DEBIT' AND person_id = $${obParamIndex}`);
    openingBalanceParams.push(filters.coachId);
    obParamIndex++;
  }

  const obAdditionalWhere = obAdditionalConditions.length > 0
    ? ' AND ' + obAdditionalConditions.join(' AND ')
    : '';

  const openingBalanceSql = `
    SELECT COALESCE(
      SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END),
      0
    ) AS opening_balance
    FROM ledger_entries
    WHERE center_id = $1
      AND transaction_date < $2
      ${obAdditionalWhere}
  `;

  const obResult = await query(openingBalanceSql, openingBalanceParams);
  const openingBalance = parseFloat(obResult.rows[0].opening_balance);

  // --- Main query with running balance via window function ---
  const mainSql = `
    SELECT
      le.*,
      ($${paramIndex} + SUM(
        CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE -le.amount END
      ) OVER (
        ORDER BY le.transaction_date ASC, le.created_at ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )) AS running_balance
    FROM ledger_entries le
    WHERE le.center_id = $1
      AND le.transaction_date BETWEEN $2 AND $3
      ${additionalWhere}
    ORDER BY le.transaction_date ASC, le.created_at ASC
  `;

  // Add opening_balance as the last parameter for the main query
  baseParams.push(openingBalance);

  const mainResult = await query(mainSql, baseParams);

  // Map rows to LedgerEntry with running balance
  const entries: LedgerEntry[] = mainResult.rows.map((row: any) => ({
    ...mapRowToLedgerEntry(row),
    runningBalance: parseFloat(row.running_balance),
  }));

  // --- Compute summary ---
  let totalCredits = 0;
  let totalDebits = 0;

  for (const entry of entries) {
    if (entry.entryType === LedgerEntryType.CREDIT) {
      totalCredits += entry.amount;
    } else {
      totalDebits += entry.amount;
    }
  }

  const netBalance = totalCredits - totalDebits;

  return {
    entries,
    summary: {
      totalCredits,
      totalDebits,
      netBalance,
      openingBalance,
    },
  };
}
