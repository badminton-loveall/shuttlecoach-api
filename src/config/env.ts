import dotenv from 'dotenv';

// Only load .env file in non-production (Vercel provides env vars directly)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

interface EnvConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  allowedOrigins: string[];
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    // Log clearly but don't throw at module load time — let individual
    // request handlers surface the error so the process doesn't crash on startup
    console.error(`❌ Missing required environment variable: ${key}`);
    return '';
  }
  return value;
};

const missingVars: string[] = [];

const requireEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    missingVars.push(key);
    console.error(`❌ Missing required environment variable: ${key}`);
    return '';
  }
  return value;
};

export const config: EnvConfig = {
  port: parseInt(getEnvVar('PORT', '5000'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  databaseUrl: requireEnvVar('DATABASE_URL'),
  jwtSecret: requireEnvVar('JWT_SECRET'),
  allowedOrigins: getEnvVar('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim()),
};

// Warn loudly in logs if critical vars are missing (visible in Vercel function logs)
if (missingVars.length > 0) {
  console.error(`🚨 Server starting with missing environment variables: ${missingVars.join(', ')}`);
  console.error('Set these in the Vercel project dashboard under Settings → Environment Variables');
}

export default config;
