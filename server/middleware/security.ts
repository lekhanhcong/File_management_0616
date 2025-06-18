// Security middleware for FileFlowMaster
// Enhanced security features based on audit findings

import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileTypeFromBuffer } from 'file-type';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { createHash } from 'crypto';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

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

// Advanced threat detection middleware
export const threatDetection = (req: Request, res: Response, next: NextFunction) => {
  const suspiciousPatterns = [
    /union.*select/gi,
    /script.*alert/gi,
    /<iframe/gi,
    /eval\(/gi,
    /document\.write/gi,
    /window\.location/gi,
    /\bor\s+1=1/gi,
    /drop\s+table/gi,
  ];

  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      console.warn(`Suspicious request detected from ${req.ip}:`, {
        pattern: pattern.source,
        url: req.url,
        userAgent: req.headers['user-agent'],
      });
      
      return res.status(400).json({
        message: 'Request contains potentially malicious content',
        code: 'THREAT_DETECTED',
      });
    }
  }

  next();
};

// IP whitelist/blacklist middleware
const blacklistedIPs = new Set<string>();
const whitelistedIPs = new Set<string>();

export const ipFiltering = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  if (blacklistedIPs.has(clientIP)) {
    return res.status(403).json({
      message: 'Access denied',
      code: 'IP_BLACKLISTED',
    });
  }

  // If whitelist is not empty and IP is not whitelisted
  if (whitelistedIPs.size > 0 && !whitelistedIPs.has(clientIP)) {
    return res.status(403).json({
      message: 'Access denied',
      code: 'IP_NOT_WHITELISTED',
    });
  }

  next();
};

// Request integrity validation
export const requestIntegrity = (req: Request, res: Response, next: NextFunction) => {
  // Validate request size
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxRequestSize = 100 * 1024 * 1024; // 100MB
  
  if (contentLength > maxRequestSize) {
    return res.status(413).json({
      message: 'Request too large',
      maxSize: maxRequestSize,
    });
  }

  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    const allowedTypes = [
      'application/json',
      'multipart/form-data',
      'application/x-www-form-urlencoded',
      'text/plain',
    ];
    
    const isAllowed = allowedTypes.some(type => contentType.includes(type));
    if (!isAllowed) {
      return res.status(400).json({
        message: 'Unsupported content type',
        allowed: allowedTypes,
      });
    }
  }

  next();
};

// Enhanced input validation
export const advancedInputValidation = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate email fields
    if (req.body?.email && !validator.isEmail(req.body.email)) {
      return res.status(400).json({
        message: 'Invalid email format',
        field: 'email',
      });
    }

    // Validate URL fields
    const urlFields = ['website', 'callback_url', 'redirect_uri'];
    for (const field of urlFields) {
      if (req.body?.[field] && !validator.isURL(req.body[field], {
        protocols: ['http', 'https'],
        require_protocol: true,
      })) {
        return res.status(400).json({
          message: `Invalid URL format for ${field}`,
          field,
        });
      }
    }

    // Validate numeric fields
    const numericFields = ['page', 'limit', 'offset', 'size'];
    for (const field of numericFields) {
      if (req.body?.[field] !== undefined && !validator.isNumeric(req.body[field].toString())) {
        return res.status(400).json({
          message: `Invalid numeric value for ${field}`,
          field,
        });
      }
    }

    // Validate boolean fields
    const booleanFields = ['public', 'shared', 'encrypted', 'active'];
    for (const field of booleanFields) {
      if (req.body?.[field] !== undefined && !validator.isBoolean(req.body[field].toString())) {
        return res.status(400).json({
          message: `Invalid boolean value for ${field}`,
          field,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Advanced input validation error:', error);
    res.status(400).json({ message: 'Input validation failed' });
  }
};

// File content scanning
export const scanFileContent = async (req: any, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      return next();
    }

    const fileBuffer = await fs.readFile(file.path);
    
    // Check for embedded malicious content
    const maliciousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload=/gi,
      /onerror=/gi,
      /eval\(/gi,
    ];

    const fileContent = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 10000));
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(fileContent)) {
        await fs.unlink(file.path); // Delete the malicious file
        return res.status(400).json({
          message: 'File contains potentially malicious content',
          code: 'MALICIOUS_FILE_DETECTED',
        });
      }
    }

    // Calculate file hash for integrity checking
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    file.hash = fileHash;

    next();
  } catch (error) {
    console.error('File content scanning error:', error);
    res.status(500).json({ message: 'File scanning failed' });
  }
};

// Session security middleware
export const sessionSecurity = (req: any, res: Response, next: NextFunction) => {
  // Regenerate session ID periodically
  const session = req.session;
  if (session) {
    const now = Date.now();
    const sessionAge = now - (session.createdAt || now);
    const maxAge = 30 * 60 * 1000; // 30 minutes
    
    if (sessionAge > maxAge) {
      session.regenerate((err: any) => {
        if (err) {
          console.error('Session regeneration error:', err);
        }
        session.createdAt = now;
        next();
      });
    } else {
      next();
    }
  } else {
    next();
  }
};

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      message: 'API key required',
      code: 'API_KEY_MISSING',
    });
  }

  // Validate API key format
  if (!/^[a-zA-Z0-9]{32,64}$/.test(apiKey)) {
    return res.status(401).json({
      message: 'Invalid API key format',
      code: 'INVALID_API_KEY_FORMAT',
    });
  }

  // TODO: Verify API key against database
  // This should be implemented with proper key management
  
  next();
};

// Generate CSRF token
export const generateCSRFToken = (req: any, res: Response, next: NextFunction) => {
  if (!req.session?.csrfToken) {
    (req.session as any).csrfToken = crypto.randomBytes(32).toString('hex');
  }
  next();
};

// Security audit logging
export const securityAuditLog = (req: Request, res: Response, next: NextFunction) => {
  const securityEvents = [
    'POST /api/auth/login',
    'POST /api/auth/register',
    'DELETE /api/auth/logout',
    'POST /api/files/upload',
    'DELETE /api/files/',
    'PUT /api/users/',
    'POST /api/teams/',
  ];

  const requestPath = `${req.method} ${req.path}`;
  const shouldLog = securityEvents.some(event => requestPath.includes(event));

  if (shouldLog) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      userId: (req as any).user?.claims?.sub,
      sessionId: (req as any).sessionID,
    };

    // TODO: Send to audit logging service
    console.log('Security Audit:', auditEntry);
  }

  next();
};

// Utility functions for security management
export const securityUtils = {
  addToBlacklist: (ip: string) => blacklistedIPs.add(ip),
  removeFromBlacklist: (ip: string) => blacklistedIPs.delete(ip),
  addToWhitelist: (ip: string) => whitelistedIPs.add(ip),
  removeFromWhitelist: (ip: string) => whitelistedIPs.delete(ip),
  getBlacklist: () => Array.from(blacklistedIPs),
  getWhitelist: () => Array.from(whitelistedIPs),
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
  threatDetection,
  ipFiltering,
  requestIntegrity,
  advancedInputValidation,
  scanFileContent,
  sessionSecurity,
  validateApiKey,
  securityAuditLog,
  securityUtils,
};