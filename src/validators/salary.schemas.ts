import { z } from 'zod';

/**
 * Regex for YYYY-MM format with valid month (01-12).
 * Matches: 2024-01, 2025-12
 * Rejects: 2024-00, 2024-13, 2024-1, 24-01
 */
const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Validation schema for salary generation request body.
 * Requires a period in YYYY-MM format with valid month.
 */
export const generateSalarySchema = z.object({
  period: z
    .string()
    .regex(periodRegex, 'period must be in YYYY-MM format with a valid month (01-12)'),
});

/**
 * Validation schema for listing salary records query parameters.
 * Optional period filter in YYYY-MM format.
 */
export const listSalaryQuerySchema = z.object({
  period: z
    .string()
    .regex(periodRegex, 'period must be in YYYY-MM format with a valid month (01-12)')
    .optional(),
});

/**
 * Validation schema for querying salary records of a specific coach.
 * Optional period filter in YYYY-MM format.
 */
export const coachSalaryQuerySchema = z.object({
  period: z
    .string()
    .regex(periodRegex, 'period must be in YYYY-MM format with a valid month (01-12)')
    .optional(),
});

export type GenerateSalaryInput = z.infer<typeof generateSalarySchema>;
export type ListSalaryQuery = z.infer<typeof listSalaryQuerySchema>;
export type CoachSalaryQuery = z.infer<typeof coachSalaryQuerySchema>;
