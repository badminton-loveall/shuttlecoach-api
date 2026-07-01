import { Application } from 'express';

// Import the app from src/server which has all routes configured
const app: Application = require('../src/server').default;

// Export for Vercel
export default app;
