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
  // Build connection string inline here to bypass any module-level caching
  let connectionStringUsed = '';
  let dbStatus: { connected: boolean; latencyMs?: number; error?: string; host?: string; connectionStringPrefix?: string } = { connected: false };
  try {
    const { Pool: PgPool } = await import('pg');
    
    const host = process.env.PGHOST;
    const port = process.env.PGPORT || '5432';
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD || '';
    const database = process.env.PGDATABASE || 'postgres';

    if (host && user) {
      const encodedPassword = encodeURIComponent(password);
      connectionStringUsed = `postgresql://${user}:***@${host}:${port}/${database}`;
      const cs = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
      
      const testPool = new PgPool({
        connectionString: cs,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 10000,
      });
      
      const start = Date.now();
      await testPool.query('SELECT 1');
      await testPool.end();
      
      dbStatus = {
        connected: true,
        latencyMs: Date.now() - start,
        host,
        connectionStringPrefix: connectionStringUsed,
      };
    } else {
      dbStatus = { connected: false, error: 'PGHOST or PGUSER not set', host: host || 'missing' };
    }
  } catch (err: any) {
    dbStatus = {
      connected: false,
      error: err?.message ?? String(err),
      host: process.env.PGHOST || 'missing',
      connectionStringPrefix: connectionStringUsed,
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
