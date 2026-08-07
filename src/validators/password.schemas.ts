import { z } from 'zod';
import { passwordSchema } from '../utils/passwordValidator';

/**
 * Schema for self-service password change.
 * Requires the current password and a valid new password.
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

/**
 * Schema for admin/head-coach password reset.
 * Only requires the new password.
 */
export const adminResetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

/**
 * Schema for forgot-password request.
 * Accepts a valid email address.
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Schema for resetting password with a token.
 * Requires the reset token and a valid new password.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
