import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config } from '../src/config/env';
import routes from '../src/routes';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler';

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Middleware
app.use(
  cors({
    origin: config.allowedOrigins || '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', routes);

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'ShuttleCoach API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Export the Express app for Vercel
export default app;
