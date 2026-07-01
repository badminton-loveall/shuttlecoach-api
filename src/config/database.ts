import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Serverless-optimized settings
  max: process.env.NODE_ENV === 'production' ? 1 : 10, // Single connection for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Query helper function
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Test database connection (lightweight)
export const testConnection = async (): Promise<void> => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected at:', result.rows[0].now);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown (only for non-serverless environments)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing database connections...');
    await pool.end();
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing database connections...');
    await pool.end();
    process.exit(0);
  });
}
