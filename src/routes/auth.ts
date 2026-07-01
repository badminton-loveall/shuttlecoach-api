import { Router } from 'express';
import { login, me } from '../controllers/auth';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { loginSchema } from '../validators/auth.schemas';

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

export default router;
