import { Router } from 'express';
import { login, me } from '../controllers/auth';
import { changePassword, forgotPassword, resetPassword } from '../controllers/password';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { loginSchema } from '../validators/auth.schemas';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/password.schemas';

const router = Router();

/**
 * POST /api/auth/login
 * Login with username and password
 * Returns JWT token with 24h expiration
 */
router.post('/login', validateRequest(loginSchema), login);

/**
 * GET /api/auth/me
 * Get authenticated user profile
 * Requires valid JWT token
 */
router.get('/me', authenticate, me);

/**
 * PUT /api/auth/change-password
 * Self-service password change (authenticated)
 */
router.put('/change-password', authenticate, validateRequest(changePasswordSchema), changePassword);

/**
 * POST /api/auth/forgot-password
 * Request a password reset email (public)
 */
router.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);

/**
 * POST /api/auth/reset-password
 * Reset password using a token (public)
 */
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);

export default router;
