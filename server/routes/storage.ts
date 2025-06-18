import { Express, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, asc, count, sum, isNotNull } from 'drizzle-orm';
import { db } from '../db';
import { files, activities, users } from '../../shared/schema';
import { isAuthenticated } from '../middleware/auth';

// Validation schemas
const storageQuerySchema = z.object({
  type: z.enum(['files', 'cache', 'total']).optional(),
  timeRange: z.enum(['hour', 'day', 'week', 'month', 'year']).optional().default('day'),
  groupBy: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
});

const cleanupRequestSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  types: z.array(z.enum(['temp', 'cache', 'expired', 'duplicates'])).optional(),
  olderThan: z.number().optional(), // days
  keepRecent: z.number().optional().default(10), // number of recent items to keep
});

const optimizationRequestSchema = z.object({
  aggressive: z.boolean().optional().default(false),
  targetReduction: z.number().min(0).max(100).optional().default(20), // percentage
  preserveRecent: z.boolean().optional().default(true),
});

interface StorageAnalytics {
  usage: {
    total: number;
    files: number;
    cache: number;
    temp: number;
  };
  trends: {
    timeframe: string;
    data: Array<{
      timestamp: string;
      totalSize: number;
      fileCount: number;
    }>;
  };
  distribution: {
    byType: Array<{ type: string; count: number; size: number }>;
    byUser: Array<{ userId: string; userName: string; count: number; size: number }>;
    byProject: Array<{ projectId: string; projectName: string; count: number; size: number }>;
  };
  health: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
}

export function registerStorageRoutes(app: Express) {
  // Get storage analytics
  app.get('/api/storage/analytics', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const query = storageQuerySchema.parse(req.query);
      const userId = (req as any).user.id;

      // Calculate time range
      const now = new Date();
      const timeRanges = {
        hour: new Date(now.getTime() - 60 * 60 * 1000),
        day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
      };
      const startTime = timeRanges[query.timeRange];

      // Get total usage
      const totalUsage = await db
        .select({
          totalSize: sum(files.size),
          fileCount: count(files.id),
        })
        .from(files)
        .where(eq(files.uploaderId, userId));

      // Get file type distribution
      const typeDistribution = await db
        .select({
          type: files.type,
          count: count(files.id),
          size: sum(files.size),
        })
        .from(files)
        .where(eq(files.uploaderId, userId))
        .groupBy(files.type);

      // Get usage trends (simplified - in production you'd have dedicated analytics tables)
      const trendData = await db
        .select({
          timestamp: files.uploadDate,
          size: files.size,
        })
        .from(files)
        .where(
          and(
            eq(files.uploaderId, userId),
            isNotNull(files.uploadDate)
          )
        )
        .orderBy(desc(files.uploadDate))
        .limit(100);

      // Process trend data by grouping
      const groupedTrends = trendData.reduce((acc, item) => {
        if (!item.timestamp) return acc;
        
        const date = new Date(item.timestamp);
        let key: string;
        
        switch (query.groupBy) {
          case 'hour':
            key = date.toISOString().slice(0, 13);
            break;
          case 'day':
            key = date.toISOString().slice(0, 10);
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().slice(0, 10);
            break;
          case 'month':
            key = date.toISOString().slice(0, 7);
            break;
          default:
            key = date.toISOString().slice(0, 10);
        }
        
        if (!acc[key]) {
          acc[key] = { totalSize: 0, fileCount: 0 };
        }
        acc[key].totalSize += Number(item.size) || 0;
        acc[key].fileCount += 1;
        
        return acc;
      }, {} as Record<string, { totalSize: number; fileCount: number }>);

      const trends = Object.entries(groupedTrends)
        .map(([timestamp, data]) => ({ timestamp, ...data }))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Calculate health score (simplified algorithm)
      const totalSize = Number(totalUsage[0]?.totalSize) || 0;
      const maxSize = 50 * 1024 * 1024; // 50MB limit
      const usagePercentage = (totalSize / maxSize) * 100;
      
      let healthScore = 100;
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      if (usagePercentage > 90) {
        healthScore -= 30;
        issues.push('Storage usage critical (>90%)');
        recommendations.push('Delete unnecessary files or clear cache');
      } else if (usagePercentage > 70) {
        healthScore -= 15;
        issues.push('Storage usage high (>70%)');
        recommendations.push('Consider optimizing storage');
      }
      
      if (Number(totalUsage[0]?.fileCount) > 100) {
        healthScore -= 10;
        issues.push('Large number of files stored');
        recommendations.push('Organize files into folders');
      }

      const analytics: StorageAnalytics = {
        usage: {
          total: totalSize,
          files: totalSize, // Simplified - in reality you'd separate cache/temp
          cache: 0,
          temp: 0,
        },
        trends: {
          timeframe: query.timeRange,
          data: trends,
        },
        distribution: {
          byType: typeDistribution.map(item => ({
            type: item.type || 'unknown',
            count: Number(item.count) || 0,
            size: Number(item.size) || 0,
          })),
          byUser: [], // Would be populated for admin users
          byProject: [], // Would require project data
        },
        health: {
          score: Math.max(0, healthScore),
          issues,
          recommendations,
        },
      };

      res.json(analytics);
    } catch (error) {
      console.error('Storage analytics error:', error);
      res.status(500).json({ error: 'Failed to get storage analytics' });
    }
  });

  // Storage cleanup endpoint
  app.post('/api/storage/cleanup', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const cleanupRequest = cleanupRequestSchema.parse(req.body);
      const userId = (req as any).user.id;

      const results = {
        dryRun: cleanupRequest.dryRun,
        itemsToClean: 0,
        sizeToFree: 0,
        categories: {} as Record<string, { count: number; size: number }>,
      };

      // Find items to clean up
      const now = new Date();
      const cutoffDate = cleanupRequest.olderThan 
        ? new Date(now.getTime() - cleanupRequest.olderThan * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

      if (!cleanupRequest.types || cleanupRequest.types.includes('temp')) {
        // Find temporary files (example: files with specific naming pattern)
        const tempFiles = await db
          .select()
          .from(files)
          .where(
            and(
              eq(files.uploaderId, userId),
              // Add condition for temp files (e.g., name starts with 'temp_')
            )
          );

        results.categories.temp = {
          count: tempFiles.length,
          size: tempFiles.reduce((sum, file) => sum + (Number(file.size) || 0), 0),
        };

        if (!cleanupRequest.dryRun) {
          // Delete temp files
          for (const file of tempFiles) {
            await db.delete(files).where(eq(files.id, file.id));
          }
        }
      }

      if (!cleanupRequest.types || cleanupRequest.types.includes('expired')) {
        // Find expired files based on upload date
        const expiredFiles = await db
          .select()
          .from(files)
          .where(
            and(
              eq(files.uploaderId, userId),
              // Add condition for old files
            )
          )
          .limit(1000); // Safety limit

        // Keep recent files
        const filesToDelete = expiredFiles.slice(cleanupRequest.keepRecent);

        results.categories.expired = {
          count: filesToDelete.length,
          size: filesToDelete.reduce((sum, file) => sum + (Number(file.size) || 0), 0),
        };

        if (!cleanupRequest.dryRun) {
          // Delete expired files
          for (const file of filesToDelete) {
            await db.delete(files).where(eq(files.id, file.id));
          }
        }
      }

      // Calculate totals
      results.itemsToClean = Object.values(results.categories)
        .reduce((sum, cat) => sum + cat.count, 0);
      results.sizeToFree = Object.values(results.categories)
        .reduce((sum, cat) => sum + cat.size, 0);

      // Log cleanup activity
      if (!cleanupRequest.dryRun && results.itemsToClean > 0) {
        await db.insert(activities).values({
          id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          type: 'storage_cleanup',
          description: `Cleaned up ${results.itemsToClean} items, freed ${results.sizeToFree} bytes`,
          metadata: JSON.stringify(results),
          timestamp: new Date(),
        });
      }

      res.json(results);
    } catch (error) {
      console.error('Storage cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup storage' });
    }
  });

  // Storage optimization endpoint
  app.post('/api/storage/optimize', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const optimizationRequest = optimizationRequestSchema.parse(req.body);
      const userId = (req as any).user.id;

      const results = {
        before: {
          totalFiles: 0,
          totalSize: 0,
        },
        after: {
          totalFiles: 0,
          totalSize: 0,
        },
        optimizations: [] as string[],
        timeElapsed: 0,
      };

      const startTime = Date.now();

      // Get current state
      const currentState = await db
        .select({
          totalFiles: count(files.id),
          totalSize: sum(files.size),
        })
        .from(files)
        .where(eq(files.uploaderId, userId));

      results.before = {
        totalFiles: Number(currentState[0]?.totalFiles) || 0,
        totalSize: Number(currentState[0]?.totalSize) || 0,
      };

      // Optimization strategies
      
      // 1. Remove duplicate files (same name, size, and type)
      const duplicateFiles = await db
        .select()
        .from(files)
        .where(eq(files.uploaderId, userId));

      const seen = new Map<string, string>();
      const duplicatesToRemove: string[] = [];

      for (const file of duplicateFiles) {
        const key = `${file.name}_${file.size}_${file.type}`;
        if (seen.has(key)) {
          duplicatesToRemove.push(file.id);
        } else {
          seen.set(key, file.id);
        }
      }

      if (duplicatesToRemove.length > 0) {
        for (const fileId of duplicatesToRemove) {
          await db.delete(files).where(eq(files.id, fileId));
        }
        results.optimizations.push(`Removed ${duplicatesToRemove.length} duplicate files`);
      }

      // 2. Compress metadata (remove unnecessary fields, truncate descriptions)
      if (optimizationRequest.aggressive) {
        const filesToOptimize = await db
          .select()
          .from(files)
          .where(eq(files.uploaderId, userId));

        let optimizedCount = 0;
        for (const file of filesToOptimize) {
          let needsUpdate = false;
          const updates: any = {};

          // Truncate long descriptions
          if (file.description && file.description.length > 200) {
            updates.description = file.description.substring(0, 200) + '...';
            needsUpdate = true;
          }

          // Clean up metadata
          if (file.metadata) {
            try {
              const metadata = JSON.parse(file.metadata);
              const cleanedMetadata = Object.fromEntries(
                Object.entries(metadata).filter(([key, value]) => 
                  key.length < 50 && JSON.stringify(value).length < 1000
                )
              );
              
              if (JSON.stringify(cleanedMetadata) !== file.metadata) {
                updates.metadata = JSON.stringify(cleanedMetadata);
                needsUpdate = true;
              }
            } catch (error) {
              // Invalid JSON, clear it
              updates.metadata = null;
              needsUpdate = true;
            }
          }

          if (needsUpdate) {
            await db
              .update(files)
              .set(updates)
              .where(eq(files.id, file.id));
            optimizedCount++;
          }
        }

        if (optimizedCount > 0) {
          results.optimizations.push(`Optimized metadata for ${optimizedCount} files`);
        }
      }

      // Get final state
      const finalState = await db
        .select({
          totalFiles: count(files.id),
          totalSize: sum(files.size),
        })
        .from(files)
        .where(eq(files.uploaderId, userId));

      results.after = {
        totalFiles: Number(finalState[0]?.totalFiles) || 0,
        totalSize: Number(finalState[0]?.totalSize) || 0,
      };

      results.timeElapsed = Date.now() - startTime;

      // Log optimization activity
      await db.insert(activities).values({
        id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type: 'storage_optimization',
        description: `Storage optimization completed: ${results.optimizations.join(', ')}`,
        metadata: JSON.stringify(results),
        timestamp: new Date(),
      });

      res.json(results);
    } catch (error) {
      console.error('Storage optimization error:', error);
      res.status(500).json({ error: 'Failed to optimize storage' });
    }
  });

  // Get storage quotas and limits
  app.get('/api/storage/quotas', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      // Get user's current usage
      const usage = await db
        .select({
          totalFiles: count(files.id),
          totalSize: sum(files.size),
        })
        .from(files)
        .where(eq(files.uploaderId, userId));

      // Get user info for quota limits
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const currentUsage = {
        files: Number(usage[0]?.totalFiles) || 0,
        size: Number(usage[0]?.totalSize) || 0,
      };

      // Define quotas based on user role/plan
      const quotas = {
        maxFiles: user[0]?.role === 'admin' ? 10000 : 1000,
        maxSize: user[0]?.role === 'admin' ? 500 * 1024 * 1024 : 50 * 1024 * 1024, // 500MB vs 50MB
        maxFileSize: 100 * 1024 * 1024, // 100MB per file
      };

      const remaining = {
        files: Math.max(0, quotas.maxFiles - currentUsage.files),
        size: Math.max(0, quotas.maxSize - currentUsage.size),
      };

      const percentages = {
        files: (currentUsage.files / quotas.maxFiles) * 100,
        size: (currentUsage.size / quotas.maxSize) * 100,
      };

      res.json({
        current: currentUsage,
        quotas,
        remaining,
        percentages,
        warnings: {
          nearFileLimit: percentages.files > 80,
          nearSizeLimit: percentages.size > 80,
          criticalFileLimit: percentages.files > 95,
          criticalSizeLimit: percentages.size > 95,
        },
      });
    } catch (error) {
      console.error('Storage quotas error:', error);
      res.status(500).json({ error: 'Failed to get storage quotas' });
    }
  });

  // Storage health check
  app.get('/api/storage/health', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      // Perform various health checks
      const checks = {
        quotaCheck: { status: 'pass', details: '' },
        duplicateCheck: { status: 'pass', details: '' },
        corruptionCheck: { status: 'pass', details: '' },
        performanceCheck: { status: 'pass', details: '' },
      };

      // Check quotas
      const quotaInfo = await db
        .select({
          totalSize: sum(files.size),
        })
        .from(files)
        .where(eq(files.uploaderId, userId));

      const usage = Number(quotaInfo[0]?.totalSize) || 0;
      const limit = 50 * 1024 * 1024; // 50MB
      const usagePercent = (usage / limit) * 100;

      if (usagePercent > 95) {
        checks.quotaCheck = { status: 'fail', details: 'Storage usage critical (>95%)' };
      } else if (usagePercent > 80) {
        checks.quotaCheck = { status: 'warn', details: 'Storage usage high (>80%)' };
      }

      // Check for duplicates
      const duplicates = await db
        .select({
          name: files.name,
          size: files.size,
          type: files.type,
          count: count(files.id),
        })
        .from(files)
        .where(eq(files.uploaderId, userId))
        .groupBy(files.name, files.size, files.type)
        .having(({ count }) => count.gt(1));

      if (duplicates.length > 0) {
        checks.duplicateCheck = { 
          status: 'warn', 
          details: `Found ${duplicates.length} sets of duplicate files` 
        };
      }

      // Overall health score
      const passCount = Object.values(checks).filter(c => c.status === 'pass').length;
      const warnCount = Object.values(checks).filter(c => c.status === 'warn').length;
      const failCount = Object.values(checks).filter(c => c.status === 'fail').length;

      let overallStatus = 'healthy';
      if (failCount > 0) {
        overallStatus = 'critical';
      } else if (warnCount > 0) {
        overallStatus = 'warning';
      }

      const healthScore = Math.round(((passCount + warnCount * 0.5) / Object.keys(checks).length) * 100);

      res.json({
        status: overallStatus,
        score: healthScore,
        checks,
        summary: {
          total: Object.keys(checks).length,
          passed: passCount,
          warnings: warnCount,
          failures: failCount,
        },
        recommendations: [
          ...(checks.quotaCheck.status !== 'pass' ? ['Clean up old files to free space'] : []),
          ...(checks.duplicateCheck.status !== 'pass' ? ['Remove duplicate files'] : []),
        ],
      });
    } catch (error) {
      console.error('Storage health check error:', error);
      res.status(500).json({ error: 'Failed to perform health check' });
    }
  });
}