import { z } from 'zod';

/**
 * Validation schema for creating a coach
 */
export const createCoachSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be at most 100 characters'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z.string().email('Invalid email format').optional(),
  specialization: z.string().max(100).optional(),
  profilePhoto: z.string().url('Profile photo must be a valid URL').optional(),
});

/**
 * Validation schema for assigning/unassigning coaches
 */
export const assignCoachSchema = z.object({
  studentIds: z.array(z.string().uuid('Invalid student ID')).optional(),
  batchId: z.string().uuid('Invalid batch ID').optional(),
  action: z.enum(['ASSIGN', 'UNASSIGN']),
});

export type CreateCoachInput = z.infer<typeof createCoachSchema>;
export type AssignCoachInput = z.infer<typeof assignCoachSchema>;
