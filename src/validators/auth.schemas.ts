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
  // No strength/length rules here on purpose — those belong to sign-up and
  // change/reset-password, not login. A login attempt just needs *a*
  // password to compare against the stored hash; rejecting a short one here
  // before that comparison ever runs was surfacing a generic "Validation
  // failed" instead of the specific, correct "Incorrect password" the login
  // controller already returns for exactly this case.
  password: z.string().min(1, 'Password is required').max(200, 'Password is too long'),
  centerSlug: z.string().optional(),
}).refine(data => data.email || data.username, {
  message: 'Email or username is required',
  path: ['email'],
});

export type LoginInput = z.infer<typeof loginSchema>;
