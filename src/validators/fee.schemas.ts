import { z } from 'zod';

/**
 * Validation schema for creating a fee record
 */
export const createFeeSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  amount: z.number().positive('Amount must be positive'),
  monthYear: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month year must be in YYYY-MM format'),
  dueDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), 'Invalid due date format'),
  notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
});

/**
 * Validation schema for marking a fee as paid
 */
export const markFeePaidSchema = z.object({
  paidDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), 'Invalid paid date format'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER']),
  transactionRef: z.string().max(100).optional(),
  notes: z.string().max(500, 'Notes must be at most 500 characters').optional(),
});

/**
 * Validation schema for waiving a fee
 */
export const waiveFeeSchema = z.object({
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must be at most 500 characters'),
});

/**
 * Validation schema for query parameters when listing fees
 */
export const listFeesQuerySchema = z.object({
  studentId: z.string().uuid('Invalid student ID').optional(),
  status: z.enum(['PAID', 'PENDING', 'OVERDUE', 'WAIVED']).optional(),
  monthYear: z.string().regex(/^\d{4}-\d{2}$/, 'Month year must be in YYYY-MM format').optional(),
});

export type CreateFeeInput = z.infer<typeof createFeeSchema>;
export type MarkFeePaidInput = z.infer<typeof markFeePaidSchema>;
export type WaiveFeeInput = z.infer<typeof waiveFeeSchema>;
export type ListFeesQuery = z.infer<typeof listFeesQuerySchema>;
