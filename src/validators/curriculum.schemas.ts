import { z } from 'zod';

/**
 * Validation schema for a drill
 */
const drillSchema = z.object({
  id: z.string().uuid('Invalid drill ID').optional(),
  name: z.string().min(2, 'Drill name must be at least 2 characters').max(100),
  description: z.string().max(500, 'Drill description must be at most 500 characters'),
  category: z.string().max(50),
});

/**
 * Validation schema for a week plan
 */
const weekPlanSchema = z.object({
  weekNumber: z.number().int().min(1).max(8),
  focusArea: z.string().min(2, 'Focus area must be at least 2 characters').max(200),
  drills: z.array(drillSchema),
  objective: z.string().min(2, 'Objective must be at least 2 characters').max(500),
});

/**
 * Validation schema for creating a curriculum plan
 */
export const createCurriculumSchema = z.object({
  cycleKey: z
    .string()
    .regex(/^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/, 'Cycle key must be in format "Jan-Feb 2026"'),
  batchId: z.string().uuid('Invalid batch ID').optional(),
  studentId: z.string().uuid('Invalid student ID').optional(),
  sourceBatchPlanId: z.string().uuid('Invalid source batch plan ID').optional(),
  weeks: z
    .array(weekPlanSchema)
    .length(8, 'Curriculum must have exactly 8 weeks')
    .refine(
      (weeks) => {
        // Ensure week numbers are 1-8 and unique
        const weekNumbers = weeks.map((w) => w.weekNumber);
        const uniqueWeeks = new Set(weekNumbers);
        return uniqueWeeks.size === 8 && weekNumbers.every((n) => n >= 1 && n <= 8);
      },
      { message: 'Weeks must have unique numbers from 1 to 8' }
    ),
});

/**
 * Validation schema for updating a curriculum plan
 */
export const updateCurriculumSchema = z.object({
  weeks: z
    .array(weekPlanSchema)
    .length(8, 'Curriculum must have exactly 8 weeks')
    .refine(
      (weeks) => {
        const weekNumbers = weeks.map((w) => w.weekNumber);
        const uniqueWeeks = new Set(weekNumbers);
        return uniqueWeeks.size === 8 && weekNumbers.every((n) => n >= 1 && n <= 8);
      },
      { message: 'Weeks must have unique numbers from 1 to 8' }
    )
    .optional(),
  isArchived: z.boolean().optional(),
});

/**
 * Validation schema for cloning a batch plan
 */
export const cloneBatchPlanSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
});

/**
 * Validation schema for query parameters when listing curriculum plans
 */
export const listCurriculumQuerySchema = z.object({
  studentId: z.string().uuid('Invalid student ID').optional(),
  cycleKey: z
    .string()
    .regex(/^[A-Z][a-z]{2}-[A-Z][a-z]{2} \d{4}$/, 'Cycle key must be in format "Jan-Feb 2026"')
    .optional(),
  batchId: z.string().uuid('Invalid batch ID').optional(),
});

export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumInput = z.infer<typeof updateCurriculumSchema>;
export type CloneBatchPlanInput = z.infer<typeof cloneBatchPlanSchema>;
export type ListCurriculumQuery = z.infer<typeof listCurriculumQuerySchema>;
