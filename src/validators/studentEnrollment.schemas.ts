import { z } from 'zod';

/**
 * Validation schemas for per-student enrollment (batch time template + curriculum + coach +
 * start date + fee) and drill-record training updates.
 */

export const createEnrollmentSchema = z.object({
  batchTimeTemplateId: z.string().uuid().optional().nullable(),
  curriculumId: z.string().uuid().optional().nullable(),
  coachId: z.string().uuid().optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  monthlyFee: z.number().min(0).optional().nullable(),
});

export const updateDrillRecordSchema = z.object({
  status: z.enum(['scheduled', 'trained', 'skipped']),
  level: z.number().int().min(0).max(4).optional().nullable(),
  coachNotes: z.string().max(2000).optional().nullable(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateDrillRecordInput = z.infer<typeof updateDrillRecordSchema>;
