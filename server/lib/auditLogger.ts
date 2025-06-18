import fs from 'fs/promises';
import path from 'path';
import { createWriteStream, WriteStream } from 'fs';
import { promisify } from 'util';
import { gzip } from 'zlib';
import { encryptionService } from './encryption';

const gzipAsync = promisify(gzip);

export interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action: string;
  details: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial';
  duration?: number;
  metadata?: Record<string, any>;
}

export enum AuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  FILE_OPERATION = 'file_operation',
  USER_MANAGEMENT = 'user_management',
  SYSTEM_EVENT = 'system_event',
  SECURITY_EVENT = 'security_event',
  COMPLIANCE_EVENT = 'compliance_event',
  CONFIGURATION_CHANGE = 'configuration_change',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

interface AuditLoggerConfig {
  logDirectory: string;
  maxFileSize: number; // in bytes
  maxFiles: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  rotationInterval: number; // in milliseconds
  bufferSize: number;
  asyncLogging: boolean;
}

class AuditLogger {
  private config: AuditLoggerConfig;
  private currentLogFile: string;
  private writeStream: WriteStream | null = null;
  private logBuffer: AuditEvent[] = [];
  private rotationTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AuditLoggerConfig>) {
    this.config = {
      logDirectory: process.env.AUDIT_LOG_DIR || './logs/audit',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 30,
      compressionEnabled: true,
      encryptionEnabled: process.env.NODE_ENV === 'production',
      rotationInterval: 24 * 60 * 60 * 1000, // 24 hours
      bufferSize: 100,
      asyncLogging: true,
      ...config,
    };

    this.currentLogFile = this.generateLogFileName();
    this.initializeLogger();
    this.setupRotationTimer();
  }

  private async initializeLogger(): Promise<void> {
    try {
      // Ensure log directory exists
      await fs.mkdir(this.config.logDirectory, { recursive: true });
      
      // Initialize write stream
      await this.createWriteStream();
      
      // Log system startup
      await this.log({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.LOW,
        action: 'audit_logger_initialized',
        details: {
          config: {
            ...this.config,
            encryptionEnabled: '***', // Don't log sensitive config
          },
        },
        outcome: 'success',
      });
    } catch (error) {
      console.error('Failed to initialize audit logger:', error);
      throw error;
    }
  }

  private generateLogFileName(): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return path.join(this.config.logDirectory, `audit-${timestamp}.log`);
  }

  private async createWriteStream(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
    }

    this.writeStream = createWriteStream(this.currentLogFile, { flags: 'a' });
    
    this.writeStream.on('error', (error) => {
      console.error('Audit log write stream error:', error);
    });
  }

  private setupRotationTimer(): void {
    this.rotationTimer = setInterval(async () => {
      await this.rotateLog();
    }, this.config.rotationInterval);
  }

  // Main logging method
  public async log(event: Partial<AuditEvent>): Promise<void> {
    const fullEvent: AuditEvent = {
      id: encryptionService.generateUUID(),
      timestamp: new Date().toISOString(),
      eventType: AuditEventType.SYSTEM_EVENT,
      severity: AuditSeverity.LOW,
      action: 'unknown',
      details: {},
      outcome: 'success',
      ...event,
    };

    try {
      if (this.config.asyncLogging) {
        this.logBuffer.push(fullEvent);
        
        if (this.logBuffer.length >= this.config.bufferSize) {
          await this.flushBuffer();
        }
      } else {
        await this.writeLogEntry(fullEvent);
      }
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Store in emergency buffer or send to emergency logging service
      await this.handleLoggingFailure(fullEvent, error);
    }
  }

  private async writeLogEntry(event: AuditEvent): Promise<void> {
    if (!this.writeStream) {
      await this.createWriteStream();
    }

    let logLine = JSON.stringify(event) + '\n';
    
    if (this.config.encryptionEnabled) {
      const encrypted = encryptionService.encrypt(logLine);
      logLine = JSON.stringify(encrypted) + '\n';
    }

    return new Promise((resolve, reject) => {
      this.writeStream!.write(logLine, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const events = [...this.logBuffer];
    this.logBuffer = [];

    try {
      for (const event of events) {
        await this.writeLogEntry(event);
      }
    } catch (error) {
      // Re-add events to buffer on failure
      this.logBuffer.unshift(...events);
      throw error;
    }
  }

  private async rotateLog(): Promise<void> {
    try {
      // Flush any buffered events
      await this.flushBuffer();
      
      // Close current stream
      if (this.writeStream) {
        this.writeStream.end();
      }

      // Compress and/or encrypt old log file if needed
      if (this.config.compressionEnabled) {
        await this.compressLogFile(this.currentLogFile);
      }

      // Generate new log file name
      this.currentLogFile = this.generateLogFileName();
      
      // Create new write stream
      await this.createWriteStream();
      
      // Clean up old log files
      await this.cleanupOldLogs();
      
      // Log rotation event
      await this.log({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.LOW,
        action: 'log_rotation_completed',
        details: {
          newLogFile: this.currentLogFile,
        },
        outcome: 'success',
      });
    } catch (error) {
      console.error('Log rotation failed:', error);
      await this.log({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.HIGH,
        action: 'log_rotation_failed',
        details: {
          error: error.message,
        },
        outcome: 'failure',
      });
    }
  }

  private async compressLogFile(filePath: string): Promise<void> {
    try {
      const data = await fs.readFile(filePath);
      const compressed = await gzipAsync(data);
      const compressedPath = `${filePath}.gz`;
      
      await fs.writeFile(compressedPath, compressed);
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to compress log file:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files
        .filter(file => file.startsWith('audit-') && (file.endsWith('.log') || file.endsWith('.log.gz')))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDirectory, file),
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); // Sort by name (newest first)

      if (logFiles.length > this.config.maxFiles) {
        const filesToDelete = logFiles.slice(this.config.maxFiles);
        
        for (const file of filesToDelete) {
          await fs.unlink(file.path);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  private async handleLoggingFailure(event: AuditEvent, error: any): Promise<void> {
    // Emergency logging to console
    console.error('AUDIT LOG FAILURE:', {
      event,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    // Try to write to emergency log file
    try {
      const emergencyLogPath = path.join(this.config.logDirectory, 'emergency.log');
      const emergencyEntry = JSON.stringify({
        type: 'logging_failure',
        originalEvent: event,
        error: error.message,
        timestamp: new Date().toISOString(),
      }) + '\n';
      
      await fs.appendFile(emergencyLogPath, emergencyEntry);
    } catch (emergencyError) {
      console.error('Emergency logging also failed:', emergencyError);
    }
  }

  // Convenience methods for different event types
  public async logAuthentication(details: {
    userId?: string;
    action: string;
    outcome: 'success' | 'failure';
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.AUTHENTICATION,
      severity: details.outcome === 'failure' ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
      ...details,
    });
  }

  public async logDataAccess(details: {
    userId: string;
    resource: string;
    action: string;
    outcome: 'success' | 'failure' | 'partial';
    ipAddress?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.LOW,
      ...details,
    });
  }

  public async logFileOperation(details: {
    userId: string;
    action: string;
    resource: string;
    outcome: 'success' | 'failure' | 'partial';
    ipAddress?: string;
    fileSize?: number;
    fileType?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.FILE_OPERATION,
      severity: AuditSeverity.LOW,
      ...details,
    });
  }

  public async logSecurityEvent(details: {
    action: string;
    severity: AuditSeverity;
    outcome: 'success' | 'failure';
    ipAddress?: string;
    userId?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.SECURITY_EVENT,
      ...details,
    });
  }

  public async logUserManagement(details: {
    adminUserId: string;
    targetUserId: string;
    action: string;
    outcome: 'success' | 'failure';
    ipAddress?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    await this.log({
      eventType: AuditEventType.USER_MANAGEMENT,
      severity: AuditSeverity.MEDIUM,
      userId: details.adminUserId,
      ...details,
    });
  }

  // Query and analysis methods
  public async queryLogs(filters: {
    startDate?: string;
    endDate?: string;
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    userId?: string;
    action?: string;
    outcome?: string;
    limit?: number;
  }): Promise<AuditEvent[]> {
    try {
      const results: AuditEvent[] = [];
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files.filter(file => file.startsWith('audit-') && file.endsWith('.log'));

      for (const file of logFiles) {
        const filePath = path.join(this.config.logDirectory, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            let event: AuditEvent;
            
            if (this.config.encryptionEnabled) {
              const encrypted = JSON.parse(line);
              const decrypted = encryptionService.decrypt(encrypted);
              event = JSON.parse(decrypted);
            } else {
              event = JSON.parse(line);
            }

            if (this.matchesFilters(event, filters)) {
              results.push(event);
              
              if (filters.limit && results.length >= filters.limit) {
                return results;
              }
            }
          } catch (parseError) {
            console.warn('Failed to parse log line:', parseError);
          }
        }
      }

      return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('Failed to query logs:', error);
      throw error;
    }
  }

  private matchesFilters(event: AuditEvent, filters: any): boolean {
    if (filters.startDate && event.timestamp < filters.startDate) return false;
    if (filters.endDate && event.timestamp > filters.endDate) return false;
    if (filters.eventType && event.eventType !== filters.eventType) return false;
    if (filters.severity && event.severity !== filters.severity) return false;
    if (filters.userId && event.userId !== filters.userId) return false;
    if (filters.action && event.action !== filters.action) return false;
    if (filters.outcome && event.outcome !== filters.outcome) return false;
    
    return true;
  }

  public async generateComplianceReport(startDate: string, endDate: string): Promise<any> {
    const events = await this.queryLogs({ startDate, endDate });
    
    const report = {
      reportPeriod: { startDate, endDate },
      totalEvents: events.length,
      eventsByType: this.groupBy(events, 'eventType'),
      eventsBySeverity: this.groupBy(events, 'severity'),
      failureEvents: events.filter(e => e.outcome === 'failure'),
      securityEvents: events.filter(e => e.eventType === AuditEventType.SECURITY_EVENT),
      complianceMetrics: {
        authenticationEvents: events.filter(e => e.eventType === AuditEventType.AUTHENTICATION).length,
        dataAccessEvents: events.filter(e => e.eventType === AuditEventType.DATA_ACCESS).length,
        fileOperationEvents: events.filter(e => e.eventType === AuditEventType.FILE_OPERATION).length,
      },
      generatedAt: new Date().toISOString(),
    };

    return report;
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  // Graceful shutdown
  public async shutdown(): Promise<void> {
    try {
      // Clear rotation timer
      if (this.rotationTimer) {
        clearInterval(this.rotationTimer);
      }

      // Flush any remaining buffered events
      await this.flushBuffer();

      // Close write stream
      if (this.writeStream) {
        this.writeStream.end();
      }

      await this.log({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.LOW,
        action: 'audit_logger_shutdown',
        details: {},
        outcome: 'success',
      });
    } catch (error) {
      console.error('Error during audit logger shutdown:', error);
    }
  }
}

// Audit middleware for Express
export function createAuditMiddleware(auditLogger: AuditLogger) {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Capture original res.end
    const originalEnd = res.end;
    
    res.end = function(chunk: any, encoding: any) {
      const duration = Date.now() - startTime;
      
      // Log the request
      auditLogger.log({
        eventType: getEventTypeFromRequest(req),
        severity: getSeverityFromResponse(res),
        userId: req.user?.claims?.sub,
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        resource: req.path,
        action: `${req.method} ${req.path}`,
        details: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          requestSize: req.headers['content-length'],
          responseSize: res.get('content-length'),
        },
        outcome: res.statusCode < 400 ? 'success' : 'failure',
        duration,
      }).catch(error => {
        console.error('Failed to log audit event:', error);
      });
      
      // Call original end
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
}

function getEventTypeFromRequest(req: any): AuditEventType {
  const path = req.path.toLowerCase();
  
  if (path.includes('/auth')) return AuditEventType.AUTHENTICATION;
  if (path.includes('/files')) return AuditEventType.FILE_OPERATION;
  if (path.includes('/users')) return AuditEventType.USER_MANAGEMENT;
  if (req.method === 'GET') return AuditEventType.DATA_ACCESS;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return AuditEventType.DATA_MODIFICATION;
  
  return AuditEventType.SYSTEM_EVENT;
}

function getSeverityFromResponse(res: any): AuditSeverity {
  const statusCode = res.statusCode;
  
  if (statusCode >= 500) return AuditSeverity.HIGH;
  if (statusCode >= 400) return AuditSeverity.MEDIUM;
  
  return AuditSeverity.LOW;
}

// Global audit logger instance
export const auditLogger = new AuditLogger();

export default AuditLogger;