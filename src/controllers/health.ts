import { Request, Response } from 'express';
import { query } from '../config/database';

/**
 * Health check endpoint
 * Reports env var status and tests live database connectivity.
 */
export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV', 'ALLOWED_ORIGINS'];
  const envStatus = requiredVars.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = !!process.env[key];
    return acc;
  }, {});

  // Also report optional explicit PG vars
  const pgVars = {
    PGHOST:     !!process.env.PGHOST,
    PGPORT:     !!process.env.PGPORT,
    PGUSER:     !!process.env.PGUSER,
    PGPASSWORD: !!process.env.PGPASSWORD,
    PGDATABASE: !!process.env.PGDATABASE,
  };

  const allConfigured = Object.values(envStatus).every(Boolean);

  // Test actual database connectivity
  let dbStatus: { connected: boolean; latencyMs?: number; error?: string; host?: string } = { connected: false };
  try {
    const start = Date.now();
    await query('SELECT 1');
    dbStatus = {
      connected: true,
      latencyMs: Date.now() - start,
      host: process.env.PGHOST || 'from DATABASE_URL',
    };
  } catch (err: any) {
    dbStatus = {
      connected: false,
      error: err?.message ?? String(err),
      host: process.env.PGHOST || 'from DATABASE_URL',
    };
  }

  const healthy = allConfigured && dbStatus.connected;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    envVarsConfigured: envStatus,
    pgVars,
    database: dbStatus,
  });
};
