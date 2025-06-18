import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Rate limiting configurations
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many API requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Interfaces
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
}

interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Token generation
export function generateTokens(user: any): { accessToken: string; refreshToken: string } {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: getUserPermissions(user.role),
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'fileflowmaster',
    audience: 'fileflowmaster-api',
  });

  const refreshPayload: RefreshTokenPayload = {
    userId: user.id,
    tokenId: crypto.randomUUID(),
  };

  const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, { 
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'fileflowmaster',
    audience: 'fileflowmaster-api',
  });

  // Store refresh token in database
  storage.storeRefreshToken(refreshPayload.tokenId, user.id, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    .catch(error => console.error('Failed to store refresh token:', error));

  return { accessToken, refreshToken };
}

// Token verification
export async function verifyToken(token: string): Promise<JWTPayload> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'fileflowmaster',
      audience: 'fileflowmaster-api',
    }) as JWTPayload;

    // Check if user is still active
    const user = await storage.getUser(decoded.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

// Refresh token verification
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'fileflowmaster',
      audience: 'fileflowmaster-api',
    }) as RefreshTokenPayload;

    // Check if refresh token exists in database
    const storedToken = await storage.getRefreshToken(decoded.tokenId);
    if (!storedToken || storedToken.userId !== decoded.userId) {
      throw new Error('Refresh token not found');
    }

    if (storedToken.expiresAt < new Date()) {
      await storage.deleteRefreshToken(decoded.tokenId);
      throw new Error('Refresh token expired');
    }

    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

// Authentication middleware
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  verifyToken(token)
    .then(decoded => {
      req.user = decoded;
      next();
    })
    .catch(error => {
      console.error('Token verification failed:', error);
      res.status(403).json({ message: 'Invalid or expired token' });
    });
}

// Role-based authorization middleware
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

// Permission-based authorization middleware
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

// Multi-factor authentication middleware
export function requireMFA(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const mfaToken = req.headers['x-mfa-token'] as string;
  if (!mfaToken) {
    return res.status(401).json({ message: 'MFA token required' });
  }

  verifyMFAToken(req.user.userId, mfaToken)
    .then(isValid => {
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid MFA token' });
      }
      next();
    })
    .catch(error => {
      console.error('MFA verification failed:', error);
      res.status(500).json({ message: 'MFA verification failed' });
    });
}

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// MFA utilities
export async function generateMFASecret(): Promise<string> {
  // Generate a base32 secret for TOTP
  return crypto.randomBytes(20).toString('base32');
}

export async function verifyMFAToken(userId: string, token: string): Promise<boolean> {
  try {
    // Get user's MFA secret
    const user = await storage.getUser(userId);
    if (!user?.mfaSecret) {
      return false;
    }

    // Verify TOTP token (using a library like 'speakeasy' in production)
    // This is a mock implementation
    const isValid = token.length === 6 && /^\d{6}$/.test(token);
    return isValid;
  } catch (error) {
    console.error('MFA verification error:', error);
    return false;
  }
}

// Session management
export async function createSession(userId: string, req: Request): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await storage.createSession({
    id: sessionId,
    userId,
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    expiresAt,
    isActive: true,
  });

  return sessionId;
}

export async function validateSession(sessionId: string): Promise<boolean> {
  try {
    const session = await storage.getSession(sessionId);
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return false;
    }

    // Update last activity
    await storage.updateSession(sessionId, { lastActivity: new Date() });
    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await storage.updateSession(sessionId, { isActive: false });
}

// Audit logging
export async function logSecurityEvent(
  event: string,
  userId: string | null,
  req: Request,
  details?: any
): Promise<void> {
  try {
    await storage.createAuditLog({
      action: event,
      resourceType: 'security',
      resourceId: userId || 'system',
      userId,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      details: {
        ...details,
        url: req.url,
        method: req.method,
      },
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// Helper functions
function getUserPermissions(role: string): string[] {
  switch (role) {
    case 'admin':
      return [
        'user.manage',
        'team.manage',
        'project.manage',
        'file.manage',
        'system.admin',
        'analytics.view',
        'audit.view',
      ];
    case 'manager':
      return [
        'team.manage',
        'project.manage',
        'file.manage',
        'analytics.view',
      ];
    case 'user':
    default:
      return [
        'file.upload',
        'file.download',
        'file.share',
        'project.create',
        'team.join',
      ];
  }
}

// Authentication middleware
export const isAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.accessToken;
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// API key authentication (for server-to-server communication)
export function authenticateApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ message: 'API key required' });
  }

  // Verify API key (store hashed keys in database)
  verifyApiKey(apiKey)
    .then(isValid => {
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid API key' });
      }
      next();
    })
    .catch(error => {
      console.error('API key verification failed:', error);
      res.status(500).json({ message: 'Authentication failed' });
    });
}

async function verifyApiKey(apiKey: string): Promise<boolean> {
  try {
    // Hash the provided key and compare with stored hashes
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    const storedKey = await storage.getApiKey(hashedKey);
    
    if (!storedKey || !storedKey.isActive || storedKey.expiresAt < new Date()) {
      return false;
    }

    // Update last used timestamp
    await storage.updateApiKey(hashedKey, { lastUsed: new Date() });
    return true;
  } catch (error) {
    console.error('API key verification error:', error);
    return false;
  }
}

// Export types for use in other modules
export type { AuthenticatedRequest, JWTPayload };