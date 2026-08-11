import { Response } from 'express';
import { query } from '../config/database';
import { TenantRequest } from '../middleware/tenantScope';
import { LedgerReferenceType } from '../types';
import { createDebitEntry, createReversalEntry, SalaryRecordForLedger } from '../services/ledgerService';

/**
 * POST /api/salary/generate
 * Generate PENDING salary records for all eligible coaches in the center.
 * Requires: HEAD_COACH role
 */
export const generateSalary = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { period } = req.body;

    if (!period) {
      res.status(400).json({ error: 'Missing required field: period' });
      return;
    }

    const centerId = req.tenantCenterId;

    // Query all coaches in the center with non-null monthly_salary
    const coachesResult = await query(
      `SELECT id, monthly_salary FROM users WHERE center_id = $1 AND role IN ('HEAD_COACH', 'ASSISTANT_COACH') AND monthly_salary IS NOT NULL`,
      [centerId]
    );

    let created = 0;
    let skipped = 0;

    for (const coach of coachesResult.rows) {
      // Check if salary record already exists for this coach and period
      const existingResult = await query(
        `SELECT id FROM salary_records WHERE coach_user_id = $1 AND salary_period = $2`,
        [coach.id, period]
      );

      if (existingResult.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert PENDING salary record
      await query(
        `INSERT INTO salary_records (coach_user_id, amount, salary_period, status, center_id) VALUES ($1, $2, $3, 'PENDING', $4)`,
        [coach.id, coach.monthly_salary, period, centerId]
      );
      created++;
    }

    res.status(200).json({ created, skipped, period });
  } catch (error) {
    console.error('Generate salary error:', error);
    res.status(500).json({
      error: 'An error occurred while generating salary records',
    });
  }
};

/**
 * GET /api/salary
 * List salary records for a given period, scoped to center.
 * Defaults to current month if no period query param provided.
 * Requires: HEAD_COACH role
 */
export const listSalary = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
    const centerId = req.tenantCenterId;

    const result = await query(
      `SELECT sr.*, u.name as coach_name FROM salary_records sr JOIN users u ON sr.coach_user_id = u.id WHERE sr.salary_period = $1 AND sr.center_id = $2 ORDER BY u.name ASC`,
      [period, centerId]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('List salary error:', error);
    res.status(500).json({
      error: 'An error occurred while listing salary records',
    });
  }
};

/**
 * GET /api/salary/coach/:coachId
 * Get salary history for a specific coach, scoped to center.
 * Supports optional period query param for filtering.
 * Requires: HEAD_COACH role
 */
export const getCoachSalary = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { coachId } = req.params;
    const period = req.query.period as string | undefined;
    const centerId = req.tenantCenterId;

    // Verify coach belongs to the requesting user's center
    const coachResult = await query(
      `SELECT id FROM users WHERE id = $1 AND center_id = $2`,
      [coachId, centerId]
    );

    if (coachResult.rows.length === 0) {
      res.status(404).json({ error: 'Coach not found' });
      return;
    }

    // Build query for salary records
    const conditions: string[] = ['coach_user_id = $1', 'center_id = $2'];
    const params: any[] = [coachId, centerId];

    if (period) {
      conditions.push(`salary_period = $3`);
      params.push(period);
    }

    const result = await query(
      `SELECT * FROM salary_records WHERE ${conditions.join(' AND ')} ORDER BY salary_period DESC`,
      params
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get coach salary error:', error);
    res.status(500).json({
      error: 'An error occurred while retrieving coach salary records',
    });
  }
};

/**
 * PATCH /api/salary/:id/pay
 * Mark a salary record as paid and create a corresponding DEBIT ledger entry.
 * Requires: HEAD_COACH role
 *
 * NOTE: This controller assumes a `salary_records` table exists with columns:
 * id, coach_user_id, amount, salary_period, payment_date, payment_method, status, center_id
 * The table should be created as part of the salary feature migration.
 */
export const markSalaryPaid = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentDate, paymentMethod } = req.body;

    if (!paymentDate || !paymentMethod) {
      res.status(400).json({
        error: 'Missing required fields: paymentDate, paymentMethod',
      });
      return;
    }

    // Check if salary record exists (with tenant scoping)
    const existingConditions: string[] = ['id = $1'];
    const existingParams: any[] = [id];

    if (req.tenantCenterId) {
      existingConditions.push('center_id = $2');
      existingParams.push(req.tenantCenterId);
    }

    const existingResult = await query(
      `SELECT id, status, coach_user_id, amount, salary_period FROM salary_records WHERE ${existingConditions.join(' AND ')}`,
      existingParams
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Salary record not found' });
      return;
    }

    const existing = existingResult.rows[0];

    if (existing.status === 'PAID') {
      res.status(400).json({ error: 'Salary is already marked as paid' });
      return;
    }

    // Update salary status to PAID
    const updateConditions: string[] = ['id = $4'];
    const updateParams: any[] = [paymentDate, paymentMethod, 'PAID', id];

    if (req.tenantCenterId) {
      updateConditions.push('center_id = $5');
      updateParams.push(req.tenantCenterId);
    }

    const result = await query(
      `UPDATE salary_records
       SET payment_date = $1, payment_method = $2, status = $3
       WHERE ${updateConditions.join(' AND ')}
       RETURNING id, coach_user_id, amount, salary_period, payment_date, payment_method, status, center_id`,
      updateParams
    );

    const salaryRecord = result.rows[0];

    // Create ledger DEBIT entry for the paid salary (non-blocking)
    try {
      const coachResult = await query(
        'SELECT full_name FROM users WHERE id = $1',
        [salaryRecord.coach_user_id]
      );
      const coachName = coachResult.rows[0]?.full_name || 'Unknown';

      const ledgerRecord: SalaryRecordForLedger = {
        id: salaryRecord.id,
        coachUserId: salaryRecord.coach_user_id,
        amount: parseFloat(salaryRecord.amount),
        paymentDate: paymentDate,
        salaryPeriod: salaryRecord.salary_period,
        paymentMethod: paymentMethod,
      };

      await createDebitEntry(ledgerRecord, coachName, req.tenantCenterId!);
    } catch (ledgerErr) {
      console.error('[Salary] Failed to create ledger entry:', ledgerErr);
      // Non-blocking: don't fail the salary update
    }

    res.status(200).json(salaryRecord);
  } catch (error) {
    console.error('Mark salary paid error:', error);
    res.status(500).json({
      error: 'An error occurred while marking salary as paid',
    });
  }
};

/**
 * PATCH /api/salary/:id/revert
 * Revert a paid salary back to PENDING status.
 * Creates a reversal ledger entry (CREDIT) to offset the original DEBIT.
 * Requires: HEAD_COACH role
 */
export const revertSalaryPaid = async (
  req: TenantRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if salary record exists and is PAID (with tenant scoping)
    const existingConditions: string[] = ['id = $1'];
    const existingParams: any[] = [id];

    if (req.tenantCenterId) {
      existingConditions.push('center_id = $2');
      existingParams.push(req.tenantCenterId);
    }

    const existingResult = await query(
      `SELECT id, status FROM salary_records WHERE ${existingConditions.join(' AND ')}`,
      existingParams
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Salary record not found' });
      return;
    }

    if (existingResult.rows[0].status !== 'PAID') {
      res.status(400).json({
        error: 'Salary is not currently paid. Only paid salaries can be reverted.',
      });
      return;
    }

    // Revert salary to PENDING
    const updateConditions: string[] = ['id = $1'];
    const updateParams: any[] = [id];

    if (req.tenantCenterId) {
      updateConditions.push('center_id = $2');
      updateParams.push(req.tenantCenterId);
    }

    const result = await query(
      `UPDATE salary_records
       SET payment_date = NULL, payment_method = NULL, status = 'PENDING'
       WHERE ${updateConditions.join(' AND ')}
       RETURNING id, coach_user_id, amount, salary_period, payment_date, payment_method, status, center_id`,
      updateParams
    );

    const salaryRecord = result.rows[0];

    // Create reversal ledger entry (non-blocking)
    try {
      await createReversalEntry(LedgerReferenceType.SALARY, id as string, req.tenantCenterId!);
    } catch (ledgerErr) {
      console.error('[Salary] Failed to create reversal entry:', ledgerErr);
      // Non-blocking: don't fail the status revert
    }

    res.status(200).json(salaryRecord);
  } catch (error) {
    console.error('Revert salary paid error:', error);
    res.status(500).json({
      error: 'An error occurred while reverting salary payment',
    });
  }
};
