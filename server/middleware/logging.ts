// ENHANCED LOGGING MIDDLEWARE
// Provides structured logging for debugging and monitoring

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
}

class Logger {
  private logDirectory: string;

  constructor() {
    this.logDirectory = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  private getLogFilePath(type: 'access' | 'error' | 'debug') {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDirectory, `${type}-${date}.log`);
  }

  logAccess(entry: LogEntry) {
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.getLogFilePath('access'), logLine);
  }

  logError(error: any, req?: Request) {
    const entry = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      url: req?.url,
      method: req?.method,
      ip: req?.ip
    };
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.getLogFilePath('error'), logLine);
  }

  logDebug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      const entry = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        message,
        data
      };
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.getLogFilePath('debug'), logLine);
    }
  }
}

const logger = new Logger();

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Only log API requests to avoid cluttering with static assets
  if (req.path.startsWith('/api/')) {
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip || 'unknown'
      };

      logger.logAccess(logEntry);

      // Console log for development
      if (process.env.NODE_ENV === 'development') {
        const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
        console.log(
          `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${statusColor}${res.statusCode}\x1b[0m ${responseTime}ms`
        );
      }
    });
  }

  next();
};

export { logger };