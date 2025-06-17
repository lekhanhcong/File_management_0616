// ENHANCED ERROR HANDLING MIDDLEWARE
// Provides comprehensive error handling with logging and user-friendly responses

import { Request, Response, NextFunction } from 'express';

interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(`Error ${err.statusCode || 500}: ${err.message}`);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Default error
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid input data';
  }

  if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized access';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired';
  }

  // Handle database errors
  if (err.message.includes('duplicate key')) {
    statusCode = 409;
    message = 'Resource already exists';
  }

  if (err.message.includes('foreign key constraint')) {
    statusCode = 400;
    message = 'Invalid reference to related resource';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  // Only handle API routes, let frontend routes pass through
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: `API endpoint ${req.originalUrl} not found`
    });
  } else {
    next();
  }
};

export { AppError };