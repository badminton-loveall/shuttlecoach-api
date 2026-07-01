import { z } from 'zod';

/**
 * Validation schema for skill score (0-4)
 */
const skillScoreSchema = z
  .number()
  .int('Skill score must be an integer')
  .min(0, 'Skill score must be at least 0')
  .max(4, 'Skill score must be at most 4');

/**
 * Validation schema for category scores
 */
const categoryScoresSchema = z.record(z.string(), skillScoreSchema);

/**
 * Validation schema for all skill scores
 */
const skillScoresSchema = z.object({
  forehand: categoryScoresSchema,
  backhand: categoryScoresSchema,
  return: categoryScoresSchema,
  service: categoryScoresSchema,
  overhead: categoryScoresSchema,
  rally: categoryScoresSchema,
});

/**
 * Validation schema for creating a skill assessment
 */
export const createAssessmentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  cycleKey: z
    .string()
    .regex(/^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/, 'Cycle key must be in format "Jan-Feb 2026"'),
  scores: skillScoresSchema,
  recordedBy: z
    .string()
    .min(2, 'Recorded by must be at least 2 characters')
    .max(100, 'Recorded by must be at most 100 characters'),
});

/**
 * Validation schema for query parameters when listing assessments
 */
export const listAssessmentsQuerySchema = z.object({
  studentId: z.string().uuid('Invalid student ID').optional(),
  cycleKey: z
    .string()
    .regex(/^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/, 'Cycle key must be in format "Jan-Feb 2026"')
    .optional(),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;
