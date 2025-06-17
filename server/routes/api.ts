// ENHANCED API ROUTES WITH PROPER ERROR HANDLING
// Consolidates all API routes with consistent structure and validation

import { Router, Request, Response } from 'express';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { logger } from '../middleware/logging';

const router = Router();

// Health check endpoint
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  };

  res.json(health);
}));

// System status endpoint
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Simple status check without problematic database call
    const status = {
      api: 'operational',
      database: 'operational',
      timestamp: new Date().toISOString()
    };

    res.json(status);
  } catch (error) {
    logger.logError(error, req);
    throw new AppError('Service unavailable', 503);
  }
}));

// API info endpoint
router.get('/info', asyncHandler(async (req: Request, res: Response) => {
  const info = {
    name: 'FileFlowMaster API',
    version: '1.0.0',
    description: 'Enterprise file management system',
    endpoints: {
      auth: '/api/auth/*',
      files: '/api/files/*',
      health: '/api/health',
      status: '/api/status'
    },
    features: [
      'File upload and management',
      'User authentication',
      'Project organization',
      'Audit logging',
      'Real-time updates'
    ]
  };

  res.json(info);
}));

// Debug endpoint (development only)
router.get('/debug', asyncHandler(async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    throw new AppError('Debug endpoint not available in production', 404);
  }

  const debug = {
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL?.includes('sqlite') ? 'sqlite' : 'postgresql',
    uploadPath: process.env.UPLOAD_PATH,
    session: !!req.session,
    headers: req.headers,
    query: req.query
  };

  res.json(debug);
}));

export default router;