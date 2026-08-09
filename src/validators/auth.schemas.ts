import { z } from 'zod';

/**
 * Validation schema for login request.
 * Accepts either email or username for backward compatibility.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .max(100, 'Email must be at most 100 characters')
    .optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .optional(),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be at most 100 characters'),
  centerSlug: z.string().optional(),
}).refine(data => data.email || data.username, {
  message: 'Email or username is required',
  path: ['email'],
});

export type LoginInput = z.infer<typeof loginSchema>;
