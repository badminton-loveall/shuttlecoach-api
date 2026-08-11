import { Response } from 'express';
import { TenantRequest } from '../middleware/tenantScope';
import { queryLedger, createManualEntry } from '../services/ledgerService';
import { LedgerEntryType, LedgerQueryFilters } from '../types';

/**
 * GET /api/ledger
 * Query ledger entries with optional filters and running balance.
 */
export const getLedger = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;
    if (!centerId) {
      res.status(403).json({ error: 'User not associated with a center' });
      return;
    }

    // Extract validated query params
    const {
      month,
      quarter,
      financial_year,
      from_date,
      to_date,
      student_id,
      coach_id,
    } = req.query as Record<string, string | undefined>;

    const filters: LedgerQueryFilters = {
      month: month || undefined,
      quarter: quarter || undefined,
      financialYear: financial_year || undefined,
      fromDate: from_date || undefined,
      toDate: to_date || undefined,
      studentId: student_id || undefined,
      coachId: coach_id || undefined,
    };

    const result = await queryLedger(filters, centerId);
    res.json(result);
  } catch (error: any) {
    console.error('[Ledger] Query error:', error);
    res.status(500).json({ error: 'An error occurred while processing ledger request' });
  }
};

/**
 * POST /api/ledger/entries
 * Create a manual ledger entry for miscellaneous income or expense.
 */
export const createManualLedgerEntry = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const centerId = req.tenantCenterId;
    if (!centerId) {
      res.status(403).json({ error: 'User not associated with a center' });
      return;
    }

    const {
      entry_type,
      amount,
      transaction_date,
      description,
      category,
      person_id,
      person_name,
      payment_method,
    } = req.body;

    const entry = await createManualEntry(
      {
        entryType: entry_type as LedgerEntryType,
        amount,
        transactionDate: transaction_date,
        description,
        category,
        personId: person_id,
        personName: person_name,
        paymentMethod: payment_method,
      },
      centerId
    );

    res.status(201).json(entry);
  } catch (error: any) {
    console.error('[Ledger] Create manual entry error:', error);

    if (error.message === 'Amount must be greater than zero') {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error.message === 'Description is required') {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'An error occurred while processing ledger request' });
  }
};
