import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './validation';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Custom error class for resource not found
 */
export class NotFoundError extends Error {
  statusCode: number;

  constructor(resource: string, identifier?: string) {
    super(identifier ? `${resource} with ID ${identifier} not found` : `${resource} not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

/**
 * Custom error class for unauthorized access
 */
export class UnauthorizedError extends Error {
  statusCode: number;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
    this.statusCode = 401;
  }
}

/**
 * Custom error class for forbidden access
 */
export class ForbiddenError extends Error {
  statusCode: number;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
    this.statusCode = 403;
  }
}

/**
 * Custom error class for bad request
 */
export class BadRequestError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
    this.statusCode = 400;
  }
}

/**
 * Global error handler middleware
 * Catches all errors and returns consistent error response format
 */
export const errorHandler = (
  err: Error | ErrorWithStatus | ValidationError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error to console (in production, consider using external service like Sentry)
  console.error('Error occurred:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Handle validation errors (from Zod)
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: 'Validation failed',
      details: err.errors,
    });
    return;
  }

  // Handle custom error types
  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof BadRequestError) {
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  // Handle database errors
  if (err.name === 'QueryFailedError' || (err as any).code) {
    const dbError = err as any;
    
    // PostgreSQL unique constraint violation
    if (dbError.code === '23505') {
      res.status(400).json({
        error: 'A record with this information already exists',
      });
      return;
    }

    // PostgreSQL foreign key violation
    if (dbError.code === '23503') {
      res.status(400).json({
        error: 'Referenced resource does not exist',
      });
      return;
    }

    // PostgreSQL not null violation
    if (dbError.code === '23502') {
      res.status(400).json({
        error: 'Required field is missing',
      });
      return;
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Invalid token',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expired',
    });
    return;
  }

  // Default to 500 Internal Server Error
  const status = (err as ErrorWithStatus).status || (err as ErrorWithStatus).statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found`,
  });
};
