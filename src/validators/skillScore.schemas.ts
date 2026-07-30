import { z } from 'zod';

/**
 * Relaxed UUID pattern that accepts any 8-4-4-4-12 hex string.
 * PostgreSQL gen_random_uuid() generates RFC 4122 v4 UUIDs, but seed data
 * may use non-compliant UUIDs. We validate format only, not RFC version bits.
 */
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidString = (fieldName: string) =>
  z.string().regex(uuidPattern, `Invalid ${fieldName}`);

/**
 * CycleKey format: "Mon-Mon YYYY" (e.g., "Jan-Feb 2026")
 */
const cycleKeyPattern = /^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/;

/**
 * Individual score entry within a batch submission
 */
const scoreEntrySchema = z.object({
  skillId: z.string().min(1, 'skillId is required'),
  skillName: z.string().min(1, 'skillName is required'),
  category: z.string().min(1, 'category is required'),
  score: z.number().int().min(0, 'Score must be at least 0').max(4, 'Score must be at most 4'),
});

/**
 * Validation schema for POST /api/skill-scores
 * Records a batch of skill scores for a student in a given week/cycle
 */
export const recordSkillScoresSchema = z.object({
  studentId: uuidString('student ID'),
  cycleKey: z.string().regex(cycleKeyPattern, 'cycleKey must match pattern Mon-Mon YYYY (e.g., "Jan-Feb 2026")'),
  weekNumber: z.number().int().min(1, 'weekNumber must be between 1 and 8').max(8, 'weekNumber must be between 1 and 8'),
  scores: z.array(scoreEntrySchema).min(1, 'At least one score entry is required'),
});

/**
 * Validation schema for GET /api/skill-scores query params
 */
export const getSkillScoresQuerySchema = z.object({
  studentId: uuidString('student ID'),
  cycleKey: z.string().regex(cycleKeyPattern, 'cycleKey must match pattern Mon-Mon YYYY (e.g., "Jan-Feb 2026")').optional(),
});

/**
 * Validation schema for GET /api/skill-scores/timeline query params
 */
export const getSkillTimelineQuerySchema = z.object({
  studentId: uuidString('student ID'),
  skillId: z.string().min(1, 'skillId is required'),
});

export type RecordSkillScoresInput = z.infer<typeof recordSkillScoresSchema>;
export type GetSkillScoresQuery = z.infer<typeof getSkillScoresQuerySchema>;
export type GetSkillTimelineQuery = z.infer<typeof getSkillTimelineQuerySchema>;
