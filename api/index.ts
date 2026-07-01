import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Create Express application
const app: Application = express();

// Global error handler for initialization errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for now (we'll restrict later)
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root route (simple, no dependencies)
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'ShuttleCoach API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API routes - lazy load to prevent initialization errors
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  try {
    // Lazy load routes to catch any initialization errors
    const routes = require('../src/routes').default;
    routes(req, res, next);
  } catch (error) {
    console.error('❌ Error loading routes:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? String(error) : 'Failed to load API routes'
    });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found'
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// Export the Express app for Vercel
export default app;
