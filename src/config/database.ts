import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Build pg connection config.
 *
 * For Supabase pooler (PgBouncer), the username MUST be passed as part of
 * a connection string — NOT as a separate `user` field. PgBouncer reads the
 * tenant/project ref from the username in the connection string startup packet.
 * Using separate host/user fields causes "tenant not found" errors.
 */
function buildPoolConfig(): PoolConfig {
  const sslConfig = { rejectUnauthorized: false };

  // If explicit PG vars are set, build a proper connection string from them
  // so PgBouncer receives the full username including project ref
  if (process.env.PGHOST && process.env.PGUSER) {
    const host = process.env.PGHOST;
    const port = process.env.PGPORT || '5432';
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD || '';
    const database = process.env.PGDATABASE || 'postgres';

    // Encode special chars in password for URL
    const encodedPassword = encodeURIComponent(password);

    const connectionString = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
    console.log('[DB] Using PG* vars as connection string, host:', host, 'user:', user, 'port:', port);

    return {
      connectionString,
      ssl: sslConfig,
    };
  }

  // Fall back to DATABASE_URL
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[DB] No DATABASE_URL or PGHOST set');
    return { ssl: sslConfig };
  }

  console.log('[DB] Using DATABASE_URL');
  return {
    connectionString: url,
    ssl: sslConfig,
  };
}

const poolConfig: PoolConfig = {
  ...buildPoolConfig(),
  max: 1,
  min: 0,
  idleTimeoutMillis:       10000,
  connectionTimeoutMillis: 30000,
  statement_timeout:       30000,
  query_timeout:           30000,
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
