import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Build pg connection config from environment variables.
 *
 * Supports two modes:
 * 1. Explicit vars: PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
 *    (preferred — avoids any URL parsing ambiguity with special chars or dotted usernames)
 * 2. DATABASE_URL connection string (fallback, parsed via URL API)
 */
function buildPoolConfig(): PoolConfig {
  const sslConfig = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;

  // Prefer explicit env vars if PGHOST is set
  if (process.env.PGHOST) {
    console.log('[DB] Using explicit PG* environment variables');
    return {
      host:     process.env.PGHOST,
      port:     parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'postgres',
      user:     process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl:      sslConfig,
    };
  }

  // Fall back to DATABASE_URL
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[DB] No DATABASE_URL or PGHOST set');
    return { ssl: sslConfig };
  }

  try {
    const parsed = new URL(url);
    console.log('[DB] Parsed DATABASE_URL — host:', parsed.hostname, 'port:', parsed.port, 'user:', parsed.username);
    return {
      host:     parsed.hostname,
      port:     parseInt(parsed.port || '5432', 10),
      database: parsed.pathname.replace(/^\//, ''),
      user:     decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      ssl:      sslConfig,
    };
  } catch (err) {
    console.error('[DB] Failed to parse DATABASE_URL:', err);
    return { connectionString: url, ssl: sslConfig };
  }
}

const poolConfig: PoolConfig = {
  ...buildPoolConfig(),
  max: 1,              // Single connection for serverless
  min: 0,
  idleTimeoutMillis:      10000,
  connectionTimeoutMillis: 30000,
  statement_timeout:      30000,
  query_timeout:          30000,
};

// Create a single shared pool instance
let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    console.log('[DB] Initializing new pool');
    pool = new Pool(poolConfig);
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('[DB] Unexpected database pool error:', err);
      pool = null; // Reset pool on error
    });
  }
  return pool;
}

export { getPool as Pool };

// Query helper function with error handling
export const query = async (text: string, params?: any[]) => {
  try {
    const p = getPool();
    console.log('[DB] Executing query:', text.substring(0, 100));
    const result = await p.query(text, params);
    console.log('[DB] Query result rows:', result.rows.length);
    return result;
  } catch (error: any) {
    console.error('[DB] Query error:', error.message);
    pool = null; // Reset pool on error
    throw error;
  }
};

// Test database connection (lightweight)
export const testConnection = async (): Promise<void> => {
  try {
    const p = getPool();
    const result = await p.query('SELECT NOW()');
    console.log('[DB] Connection test successful at:', result.rows[0].now);
  } catch (error) {
    console.error('[DB] Connection test failed:', error);
    throw error;
  }
};

// Graceful shutdown (only for non-serverless environments)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  process.on('SIGTERM', async () => {
    console.log('[DB] SIGTERM received, closing database connections...');
    if (pool) {
      await pool.end();
      pool = null;
    }
  });

  process.on('SIGINT', async () => {
    console.log('[DB] SIGINT received, closing database connections...');
    if (pool) {
      await pool.end();
      pool = null;
    }
    process.exit(0);
  });
}
