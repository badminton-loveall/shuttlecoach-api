import { z } from 'zod';

/**
 * Relaxed UUID pattern that accepts any 8-4-4-4-12 hex string.
 */
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidString = (fieldName: string) =>
  z.string().regex(uuidPattern, `Invalid ${fieldName}`);

/**
 * Validation schema for creating a training log
 */
export const createTrainingLogSchema = z.object({
  studentId: uuidString('student ID'),
  weekNumber: z.number().int().min(1).max(8, 'Week number must be between 1 and 8'),
  cycleKey: z
    .string()
    .regex(/^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/, 'Cycle key must be in format "Jan-Feb 2026"'),
  sessionNotes: z
    .string()
    .min(10, 'Session notes must be at least 10 characters')
    .max(2000, 'Session notes must be at most 2000 characters'),
  isCompleted: z.boolean().optional(),
  recordedBy: z
    .string()
    .min(2, 'Recorded by must be at least 2 characters')
    .max(100, 'Recorded by must be at most 100 characters'),
});

/**
 * Validation schema for query parameters when listing training logs
 */
export const listTrainingLogsQuerySchema = z.object({
  studentId: uuidString('student ID').optional(),
  cycleKey: z
    .string()
    .regex(/^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/, 'Cycle key must be in format "Jan-Feb 2026"')
    .optional(),
  weekNumber: z.string().regex(/^[1-8]$/).transform(Number).optional(),
});

export type CreateTrainingLogInput = z.infer<typeof createTrainingLogSchema>;
export type ListTrainingLogsQuery = z.infer<typeof listTrainingLogsQuerySchema>;
