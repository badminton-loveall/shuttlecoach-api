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
  origin: '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Root route (simple, no dependencies)
app.get('/', (_req: Request, res: Response) => {
  console.log('✅ Root route hit');
  res.json({
    message: 'ShuttleCoach API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  console.log('✅ Health check hit');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API routes - import lazily to avoid initialization issues
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`Loading routes for: ${req.method} ${req.path}`);
    // Import routes synchronously
    const routesModule = require('../dist/routes/index');
    const routes = routesModule.default || routesModule;
    
    if (typeof routes === 'function') {
      routes(req, res, next);
    } else {
      res.status(500).json({
        error: 'Routes not properly exported',
        message: 'Failed to load API routes'
      });
    }
  } catch (error) {
    console.error('❌ Error loading routes:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? String(error) : 'Failed to load API routes',
      detail: String(error)
    });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  console.log('❌ 404 - Route not found');
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: _req.path
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
