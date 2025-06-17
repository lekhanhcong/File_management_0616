// Performance optimization middleware for FileFlowMaster
// Based on performance audit findings

import type { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';

// Response compression
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024, // Only compress if size > 1KB
});

// Cache configuration
const responseCache = new LRUCache<string, any>({
  max: 500, // Maximum 500 cached responses
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  allowStale: true,
  updateAgeOnGet: false,
  updateAgeOnHas: false,
});

// API response caching middleware
export const apiCache = (ttl: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = generateCacheKey(req);
    
    // Check cache
    const cachedResponse = responseCache.get(cacheKey);
    if (cachedResponse) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', `public, max-age=${ttl}`);
      return res.json(cachedResponse);
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCache.set(cacheKey, body, { ttl: ttl * 1000 });
      }
      
      res.set('X-Cache', 'MISS');
      res.set('Cache-Control', `public, max-age=${ttl}`);
      return originalJson(body);
    };

    next();
  };
};

// Performance monitoring middleware
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    // Log slow requests
    if (duration > 1000) { // Log requests > 1 second
      console.warn(`Slow request: ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
    }
    
    // Log high memory usage
    if (memoryDelta > 10 * 1024 * 1024) { // Log if memory increased by > 10MB
      console.warn(`High memory usage: ${req.method} ${req.path} - ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    }
    
    // Add performance headers
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
    res.set('X-Memory-Delta', `${(memoryDelta / 1024).toFixed(2)}KB`);
  });

  next();
};

// Request timeout middleware
export const requestTimeout = (timeout: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({ 
          message: 'Request timeout',
          timeout: timeout 
        });
      }
    }, timeout);

    res.on('finish', () => {
      clearTimeout(timer);
    });

    res.on('close', () => {
      clearTimeout(timer);
    });

    next();
  };
};

// ETag generation for static responses
export const etag = (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    return next();
  }

  const originalSend = res.send.bind(res);
  res.send = function(body: any) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const etag = generateETag(body);
      res.set('ETag', etag);
      
      // Check if client has current version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        res.status(304);
        return res.end();
      }
    }
    
    return originalSend(body);
  };

  next();
};

// Database query optimization helper
export const optimizeQuery = (req: any, res: Response, next: NextFunction) => {
  // Add query optimization hints to request
  req.queryOpts = {
    // Default pagination
    limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
    offset: parseInt(req.query.offset as string) || 0,
    
    // Include/exclude fields optimization
    fields: req.query.fields ? 
      (req.query.fields as string).split(',').slice(0, 20) : // Limit fields
      undefined,
      
    // Search optimization
    search: req.query.search ? 
      (req.query.search as string).trim().substring(0, 100) : // Limit search length
      undefined,
  };
  
  next();
};

// Request debouncing for search endpoints
const requestTimestamps = new Map<string, number>();

export const debounceRequests = (delay: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}-${req.path}-${JSON.stringify(req.query)}`;
    const now = Date.now();
    const lastRequest = requestTimestamps.get(key);
    
    if (lastRequest && (now - lastRequest) < delay) {
      return res.status(429).json({ 
        message: 'Request too frequent, please wait',
        retryAfter: delay - (now - lastRequest)
      });
    }
    
    requestTimestamps.set(key, now);
    
    // Cleanup old entries periodically
    if (requestTimestamps.size > 1000) {
      const cutoff = now - delay * 10;
      for (const [k, timestamp] of Array.from(requestTimestamps.entries())) {
        if (timestamp < cutoff) {
          requestTimestamps.delete(k);
        }
      }
    }
    
    next();
  };
};

// Helper functions
function generateCacheKey(req: Request): string {
  const key = `${req.method}:${req.path}:${JSON.stringify(req.query)}:${req.headers.authorization || ''}`;
  return createHash('md5').update(key).digest('hex');
}

function generateETag(content: any): string {
  const data = typeof content === 'string' ? content : JSON.stringify(content);
  return `"${createHash('md5').update(data).digest('hex')}"`;
}

export default {
  compressionMiddleware,
  apiCache,
  performanceMonitor,
  requestTimeout,
  etag,
  optimizeQuery,
  debounceRequests,
};