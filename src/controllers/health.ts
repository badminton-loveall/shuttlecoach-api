import { Request, Response } from 'express';

/**
 * Health check endpoint
 * Also reports which required env vars are configured (not their values)
 */
export const healthCheck = (_req: Request, res: Response): void => {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV', 'ALLOWED_ORIGINS'];
  const envStatus = requiredVars.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = !!process.env[key];
    return acc;
  }, {});

  const allConfigured = Object.values(envStatus).every(Boolean);

  res.status(allConfigured ? 200 : 503).json({
    status: allConfigured ? 'ok' : 'misconfigured',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    envVarsConfigured: envStatus,
  });
};
