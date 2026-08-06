import { z } from 'zod';

/**
 * Relaxed UUID pattern that accepts any 8-4-4-4-12 hex string.
 */
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidString = (fieldName: string) =>
  z.string().regex(uuidPattern, `Invalid ${fieldName}`);

const dayOfWeek = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

export const createBatchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  schedule: z.string().max(100, 'Schedule must be at most 100 characters').optional(),
  assignedCoachId: uuidString('coach ID').optional().or(z.literal('')).transform(val => val || undefined),
  assigned_coach_id: uuidString('coach ID').optional().or(z.literal('')).transform(val => val || undefined),
  capacity: z.number().int().min(0, 'Capacity must be non-negative').optional(),
  skill_level: z.string().max(50).optional(),
  monthly_fee: z.number().min(0, 'Monthly fee must be non-negative').optional(),
  days_of_week: z.array(dayOfWeek).optional(),
  start_time: z.string().max(10).optional(),
  end_time: z.string().max(10).optional(),
  description: z.string().max(500).optional(),
});

export const updateBatchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  schedule: z.string().max(100, 'Schedule must be at most 100 characters').optional(),
  assignedCoachId: uuidString('coach ID').optional().or(z.literal('')).transform(val => val || undefined),
  assigned_coach_id: uuidString('coach ID').optional().or(z.literal('')).transform(val => val || undefined),
  capacity: z.number().int().min(0, 'Capacity must be non-negative').optional(),
  skill_level: z.string().max(50).optional(),
  monthly_fee: z.number().min(0, 'Monthly fee must be non-negative').optional(),
  days_of_week: z.array(dayOfWeek).optional(),
  start_time: z.string().max(10).optional(),
  end_time: z.string().max(10).optional(),
  description: z.string().max(500).optional(),
});

export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
