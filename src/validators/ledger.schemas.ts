import { z } from 'zod';

/**
 * Relaxed UUID pattern that accepts any 8-4-4-4-12 hex string.
 */
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidString = (fieldName: string) =>
  z.string().regex(uuidPattern, `Invalid ${fieldName}`);

/**
 * Validation schema for GET /api/ledger query parameters.
 * All fields are optional; the service defaults to current month if no time filter is provided.
 */
export const ledgerQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Invalid month format. Expected YYYY-MM')
    .optional(),
  quarter: z
    .enum(['Q1', 'Q2', 'Q3', 'Q4'], {
      error: 'Invalid quarter. Must be Q1, Q2, Q3, or Q4',
    })
    .optional(),
  financial_year: z
    .string()
    .regex(/^\d{4}-\d{4}$/, 'Invalid financial year format. Expected YYYY-YYYY')
    .optional(),
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD')
    .optional(),
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD')
    .optional(),
  student_id: uuidString('student_id').optional(),
  coach_id: uuidString('coach_id').optional(),
});

/**
 * Validation schema for POST /api/ledger/entries request body.
 */
export const manualEntrySchema = z.object({
  entry_type: z.enum(['CREDIT', 'DEBIT'], {
    error: 'entry_type must be CREDIT or DEBIT',
  }),
  amount: z.number().positive('Amount must be greater than zero'),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
  description: z
    .string()
    .min(1, 'Description is required')
    .transform((s) => s.trim())
    .refine((s) => s.length > 0, 'Description is required'),
  category: z.string().max(100).optional(),
  person_id: uuidString('person_id').optional(),
  person_name: z.string().max(200).optional(),
  payment_method: z.string().max(20).optional(),
});

export type LedgerQueryInput = z.infer<typeof ledgerQuerySchema>;
export type ManualEntryInput = z.infer<typeof manualEntrySchema>;
