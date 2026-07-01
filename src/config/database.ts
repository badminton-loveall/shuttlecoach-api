import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Serverless-optimized settings
  max: 1, // Single connection for serverless (prevent connection pool exhaustion)
  min: 0,
  idleTimeoutMillis: 10000, // Reduced idle timeout
  connectionTimeoutMillis: 30000, // Increased timeout for external DB
  statement_timeout: 30000,
  query_timeout: 30000,
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
