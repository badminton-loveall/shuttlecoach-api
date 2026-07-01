import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Load environment variables
dotenv.config();

// Create Express application
const app: Application = express();

// Middleware
app.use(
  cors({
    origin: config.allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development)
if (config.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// API routes
app.use('/api', routes);

// Root route
app.get('/', (_req, res) => {
  res.json({
    message: 'ShuttleCoach API',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Export app for serverless/modules
export default app;

// Only start server if running directly (not imported as module)
if (require.main === module) {
  const startServer = async (): Promise<void> => {
    try {
      const { testConnection } = await import('./config/database');
      await testConnection();

      app.listen(config.port, () => {
        console.log(`
╔════════════════════════════════════════╗
║   ShuttleCoach API Server Started     ║
╠════════════════════════════════════════╣
║  Port:        ${config.port.toString().padEnd(24)} ║
║  Environment: ${config.nodeEnv.padEnd(24)} ║
║  Database:    Connected ✅             ║
╚════════════════════════════════════════╝
      `);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}
