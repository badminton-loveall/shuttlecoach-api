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

// Root route
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

// API routes
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(`🔍 Loading routes for: ${req.method} ${req.path}`);
    console.log(`📁 Current working directory: ${process.cwd()}`);
    console.log(`📁 __dirname: ${__dirname}`);
    
    // Try to load routes with detailed logging
    let routes;
    try {
      console.log('🔎 Trying to require ./routes');
      routes = require('./routes');
      console.log('✅ Module loaded:', typeof routes);
      console.log('✅ Module keys:', Object.keys(routes));
      routes = routes.default || routes;
      console.log('✅ After default extraction:', typeof routes);
    } catch (loadError) {
      console.error('❌ Failed to load ./routes:', loadError);
      throw loadError;
    }
    
    if (typeof routes === 'function') {
      console.log('✅ Routes is a function, calling it');
      routes(req, res, next);
    } else {
      console.error('❌ Routes is not a function, it is:', typeof routes);
      res.status(500).json({
        error: 'Routes not properly exported',
        message: 'Routes module does not export a function',
        type: typeof routes
      });
    }
  } catch (error) {
    console.error('❌ Error loading routes:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to load API routes',
      detail: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
});

// 404 handler
app.use((_req: Request, res: Response) => {
  console.log(`❌ 404 - Route not found: ${_req.path}`);
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

export default app;
