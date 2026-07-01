import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { config } from '../src/config/env';
import routes from '../src/routes';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler';

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

// Request logging (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// API routes
app.use('/api', routes);

// Root route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'ShuttleCoach API',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'running'
  });
});

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Export the Express app for Vercel
export default app;
