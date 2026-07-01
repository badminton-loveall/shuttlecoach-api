import { Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { FeeRecord, FeeStatus, PaymentMethod } from '../types';

/**
 * POST /api/fees
 * Create a new fee record
 * Requires: HEAD_COACH role
 */
export const createFee = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      studentId,
      amount,
      monthYear,
      dueDate,
      notes,
    } = req.body;

    // Validate required fields
    if (!studentId || !amount || !monthYear || !dueDate) {
      res.status(400).json({
        error: 'Missing required fields: studentId, amount, monthYear, dueDate',
      });
      return;
    }

    // Validate monthYear format (YYYY-MM)
    const monthYearPattern = /^\d{4}-\d{2}$/;
    if (!monthYearPattern.test(monthYear)) {
      res.status(400).json({
        error: 'Invalid monthYear format. Expected format: YYYY-MM (e.g., 2026-01)',
      });
      return;
    }

    // Validate student exists
    const studentCheck = await query(
      'SELECT id FROM students WHERE id = $1',
      [studentId]
    );

    if (studentCheck.rows.length === 0) {
      res.status(404).json({
        error: 'Student not found',
      });
      return;
    }

    // Insert fee record into database
    const result = await query(
      `INSERT INTO fee_records (
        student_id, amount, month_year, due_date, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, student_id, amount, month_year, due_date, paid_date,
        status, payment_method, transaction_ref, notes,
        created_at, updated_at`,
      [
        studentId,
        amount,
        monthYear,
        dueDate,
        FeeStatus.PENDING, // New fees start as PENDING
        notes || null,
      ]
    );

    const feeRecord = mapDatabaseRowToFeeRecord(result.rows[0]);
    res.status(201).json(feeRecord);
  } catch (error) {
    console.error('Create fee error:', error);
    res.status(500).json({
      error: 'An error occurred while creating fee record',
    });
  }
};

/**
 * GET /api/fees
 * Query fee records with filters
 * Query params: ?studentId=<id>&status=<PAID|PENDING|OVERDUE|WAIVED>&monthYear=<2026-01>
 * Authorization: HEAD_COACH sees all, ASSISTANT_COACH sees only assigned students, STUDENT sees only own fees
 */
export const listFees = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { studentId, status, monthYear } = req.query;

    // Build WHERE clause based on role and filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (req.user.role === 'ASSISTANT_COACH') {
      // Assistant coaches see fees for assigned students only
      conditions.push(`student_id IN (
        SELECT id FROM students WHERE assigned_coach_id = $${paramIndex}
      )`);
      params.push(req.user.id);
      paramIndex++;
    } else if (req.user.role === 'STUDENT') {
      // Students see only their own fees
      conditions.push(`student_id = $${paramIndex}`);
      params.push(req.user.id);
      paramIndex++;
    }

    // Student filter
    if (studentId) {
      conditions.push(`student_id = $${paramIndex}`);
      params.push(studentId);
      paramIndex++;
    }

    // Status filter
    if (status) {
      // Validate status value
      if (!Object.values(FeeStatus).includes(status as FeeStatus)) {
        res.status(400).json({
          error: `Invalid status. Must be one of: ${Object.values(FeeStatus).join(', ')}`,
        });
        return;
      }
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Month/Year filter
    if (monthYear) {
      conditions.push(`month_year = $${paramIndex}`);
      params.push(monthYear);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query fees with computed OVERDUE status
    // If due_date < CURRENT_DATE AND status = 'PENDING', return status as 'OVERDUE'
    const feesResult = await query(
      `SELECT 
        id, student_id, amount, month_year, due_date, paid_date,
        CASE 
          WHEN status = 'PENDING' AND due_date < CURRENT_DATE THEN 'OVERDUE'
          ELSE status
        END as status,
        payment_method, transaction_ref, notes,
        created_at, updated_at
      FROM fee_records
      ${whereClause}
      ORDER BY due_date DESC`,
      params
    );

    const fees = feesResult.rows.map(mapDatabaseRowToFeeRecord);

    res.status(200).json(fees);
  } catch (error) {
    console.error('List fees error:', error);
    res.status(500).json({
      error: 'An error occurred while fetching fees',
    });
  }
};

/**
 * PATCH /api/fees/:id/pay
 * Mark a fee as paid with payment details
 * Requires: HEAD_COACH role
 */
export const markFeePaid = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      paidDate,
      paymentMethod,
      transactionRef,
      notes,
    } = req.body;

    // Validate required fields
    if (!paidDate || !paymentMethod) {
      res.status(400).json({
        error: 'Missing required fields: paidDate, paymentMethod',
      });
      return;
    }

    // Validate payment method
    if (!Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
      res.status(400).json({
        error: `Invalid paymentMethod. Must be one of: ${Object.values(PaymentMethod).join(', ')}`,
      });
      return;
    }

    // Check if fee record exists
    const existingResult = await query(
      'SELECT id, status FROM fee_records WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Fee record not found' });
      return;
    }

    const existingFee = existingResult.rows[0];

    // Check if fee is already paid or waived
    if (existingFee.status === FeeStatus.PAID) {
      res.status(400).json({
        error: 'Fee is already marked as paid',
      });
      return;
    }

    if (existingFee.status === FeeStatus.WAIVED) {
      res.status(400).json({
        error: 'Fee is waived and cannot be marked as paid',
      });
      return;
    }

    // Update fee record
    const result = await query(
      `UPDATE fee_records
      SET 
        paid_date = $1,
        status = $2,
        payment_method = $3,
        transaction_ref = $4,
        notes = $5
      WHERE id = $6
      RETURNING 
        id, student_id, amount, month_year, due_date, paid_date,
        status, payment_method, transaction_ref, notes,
        created_at, updated_at`,
      [
        paidDate,
        FeeStatus.PAID,
        paymentMethod,
        transactionRef || null,
        notes || null,
        id,
      ]
    );

    const feeRecord = mapDatabaseRowToFeeRecord(result.rows[0]);
    res.status(200).json(feeRecord);
  } catch (error) {
    console.error('Mark fee paid error:', error);
    res.status(500).json({
      error: 'An error occurred while marking fee as paid',
    });
  }
};

/**
 * PATCH /api/fees/:id/waive
 * Mark a fee as waived with a reason
 * Requires: HEAD_COACH role
 */
export const waiveFee = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate required fields
    if (!reason) {
      res.status(400).json({
        error: 'Missing required field: reason',
      });
      return;
    }

    // Check if fee record exists
    const existingResult = await query(
      'SELECT id, status FROM fee_records WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      res.status(404).json({ error: 'Fee record not found' });
      return;
    }

    const existingFee = existingResult.rows[0];

    // Check if fee is already paid or waived
    if (existingFee.status === FeeStatus.PAID) {
      res.status(400).json({
        error: 'Fee is already marked as paid and cannot be waived',
      });
      return;
    }

    if (existingFee.status === FeeStatus.WAIVED) {
      res.status(400).json({
        error: 'Fee is already waived',
      });
      return;
    }

    // Update fee record
    const result = await query(
      `UPDATE fee_records
      SET 
        status = $1,
        notes = $2
      WHERE id = $3
      RETURNING 
        id, student_id, amount, month_year, due_date, paid_date,
        status, payment_method, transaction_ref, notes,
        created_at, updated_at`,
      [
        FeeStatus.WAIVED,
        reason,
        id,
      ]
    );

    const feeRecord = mapDatabaseRowToFeeRecord(result.rows[0]);
    res.status(200).json(feeRecord);
  } catch (error) {
    console.error('Waive fee error:', error);
    res.status(500).json({
      error: 'An error occurred while waiving fee',
    });
  }
};

/**
 * Helper function to map database row to FeeRecord type
 */
function mapDatabaseRowToFeeRecord(row: any): FeeRecord {
  return {
    id: row.id,
    studentId: row.student_id,
    amount: parseFloat(row.amount),
    monthYear: row.month_year,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    status: row.status as FeeStatus,
    paymentMethod: row.payment_method as PaymentMethod | undefined,
    transactionRef: row.transaction_ref,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
