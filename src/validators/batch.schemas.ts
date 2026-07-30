import { z } from 'zod';

/**
 * Relaxed UUID pattern that accepts any 8-4-4-4-12 hex string.
 */
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidString = (fieldName: string) =>
  z.string().regex(uuidPattern, `Invalid ${fieldName}`);

export const createBatchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  schedule: z.string().max(100, 'Schedule must be at most 100 characters').optional(),
  assignedCoachId: uuidString('coach ID').optional().or(z.literal('')).transform(val => val || undefined),
});

export const updateBatchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  schedule: z.string().max(100, 'Schedule must be at most 100 characters').optional(),
  assignedCoachId: uuidString('coach ID').optional().or(z.literal('')).transform(val => val || undefined),
}).strict();

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
