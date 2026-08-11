import { z } from 'zod';

/**
 * Relaxed UUID pattern that accepts any 8-4-4-4-12 hex string.
 */
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidString = (fieldName: string) =>
  z.string().regex(uuidPattern, `Invalid ${fieldName}`);

/**
 * Shared validation for monthlySalary: must be a positive number or null.
 * Zero and negative values are rejected.
 */
const monthlySalarySchema = z
  .number()
  .positive('monthly_salary must be a positive number or null')
  .nullable()
  .optional();

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
  // Extended profile fields
  phone: z.string().max(20, 'Phone must be at most 20 characters').optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  experienceYears: z.number().int().min(0).optional(),
  bankDetails: z.string().optional(),
  monthlySalary: monthlySalarySchema,
});

/**
 * Validation schema for updating a coach (PATCH requests).
 * All fields are optional to support partial updates.
 */
export const updateCoachSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  email: z.string().email('Invalid email format').optional(),
  specialization: z.string().max(100).optional(),
  profilePhoto: z.string().url('Profile photo must be a valid URL').optional(),
  phone: z.string().max(20, 'Phone must be at most 20 characters').optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  experienceYears: z.number().int().min(0).optional(),
  bankDetails: z.string().optional(),
  monthlySalary: monthlySalarySchema,
});

/**
 * Validation schema for assigning/unassigning coaches
 */
export const assignCoachSchema = z.object({
  studentIds: z.array(uuidString('student ID')).optional(),
  batchId: uuidString('batch ID').optional(),
  action: z.enum(['ASSIGN', 'UNASSIGN']),
});

export type CreateCoachInput = z.infer<typeof createCoachSchema>;
export type UpdateCoachInput = z.infer<typeof updateCoachSchema>;
export type AssignCoachInput = z.infer<typeof assignCoachSchema>;
