import { z } from 'zod';

/**
 * Validation schemas for Batch Time Template CRUD operations.
 * Shared between backend routes and frontend form validation.
 */

export const dayOfWeek = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

export const timeFormat = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  'Must be HH:MM 24-hour format'
);

export const sessionSlotSchema = z.object({
  day_of_week: dayOfWeek,
  start_time: timeFormat,
  duration_hours: z.number().int().min(1).max(4),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  slots: z.array(sessionSlotSchema).min(1, 'At least one session slot is required').max(14, 'Maximum 14 session slots allowed'),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  slots: z.array(sessionSlotSchema).min(1, 'At least one session slot is required').max(14, 'Maximum 14 session slots allowed').optional(),
});

export type DayOfWeek = z.infer<typeof dayOfWeek>;
export type SessionSlot = z.infer<typeof sessionSlotSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
