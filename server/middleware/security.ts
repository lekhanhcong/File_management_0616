// Security middleware for FileFlowMaster
// Enhanced security features based on audit findings

import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import fs from 'fs/promises';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// Rate limiting configurations
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
});

export const uploadRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: {
    error: 'Too many upload attempts, please try again later.'
  },
});

// File validation constants
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const DANGEROUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar'];

// File upload validation middleware
export const validateFileUpload = async (req: any, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      });
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ 
        message: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` 
      });
    }

    // Check dangerous file extensions
    const ext = path.extname(file.originalname).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ 
        message: "File extension not allowed for security reasons" 
      });
    }

    // Verify file content matches MIME type
    try {
      const fileBuffer = await fs.readFile(file.path);
      const detectedType = await fileTypeFromBuffer(fileBuffer);
      
      if (detectedType && detectedType.mime !== file.mimetype) {
        return res.status(400).json({ 
          message: "File content does not match declared type" 
        });
      }
    } catch (error) {
      console.warn('File type detection failed:', error);
      // Continue - file type detection is not critical
    }

    // Sanitize filename
    const sanitizedName = file.originalname
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
    
    file.sanitizedName = sanitizedName;
    
    next();
  } catch (error) {
    console.error('File validation error:', error);
    res.status(500).json({ message: "File validation failed" });
  }
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query params
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({ message: "Invalid input data" });
  }
};

// Object sanitization helper
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Authorization helper
export const requireFileOwnership = async (req: any, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.claims?.sub;
    const fileId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // This should be imported from storage, but we'll implement here for demo
    // In real implementation, inject storage dependency
    const storage = req.app.locals.storage;
    const file = await storage.getFile(fileId);
    
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }
    
    if (file.uploadedBy !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    req.file = file;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({ message: "Authorization check failed" });
  }
};

// CSRF protection for form submissions
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Simple CSRF token validation
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = (req.session as any)?.csrfToken;
    
    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({ message: "Invalid CSRF token" });
    }
  }
  
  next();
};

// Generate CSRF token
export const generateCSRFToken = (req: any, res: Response, next: NextFunction) => {
  if (!req.session?.csrfToken) {
    (req.session as any).csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  next();
};

export default {
  securityHeaders,
  apiRateLimit,
  authRateLimit,
  uploadRateLimit,
  validateFileUpload,
  sanitizeInput,
  requireFileOwnership,
  csrfProtection,
  generateCSRFToken,
};