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
    console.error(`❌ Missing required environment variable: ${key}`);
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config: EnvConfig = {
  port: parseInt(getEnvVar('PORT', '5000'), 10),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  databaseUrl: getEnvVar('DATABASE_URL'),
  jwtSecret: getEnvVar('JWT_SECRET'),
  allowedOrigins: getEnvVar('ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000').split(',').map(o => o.trim()),
};

export default config;
