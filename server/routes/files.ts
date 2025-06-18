import type { Express } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

// Enhanced file validation schemas
const updateFileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  fileCategory: z.string().max(50).optional(),
  customMetadata: z.record(z.any()).optional(),
  accessPermissions: z.object({
    public: z.boolean().optional(),
    allowDownload: z.boolean().optional(),
    allowShare: z.boolean().optional(),
    allowComment: z.boolean().optional(),
    allowEdit: z.boolean().optional(),
    expiresAt: z.string().datetime().optional(),
  }).optional(),
  isOfflineAvailable: z.boolean().optional(),
});

const bulkOperationSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1),
  operation: z.enum(['delete', 'move', 'copy', 'archive', 'restore']),
  targetProjectId: z.string().uuid().optional(),
  targetTeamId: z.string().uuid().optional(),
});

const shareFileSchema = z.object({
  expiresAt: z.string().datetime().optional(),
  maxDownloads: z.number().positive().optional(),
  password: z.string().optional(),
  permissions: z.enum(['view', 'download', 'comment']).default('view'),
});

// Configure enhanced multer for file uploads
const upload = multer({
  dest: "./uploads/temp",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10, // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Enhanced file type validation
    const allowedTypes = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/rtf',
      
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      
      // Audio
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      
      // Video
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/avi',
      'video/mov',
      
      // Archives
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar',
      
      // Code files
      'application/json',
      'application/xml',
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export function registerFileRoutes(app: Express) {
  // Enhanced file upload with multiple files support
  app.post('/api/files/upload', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const files = req.files as Express.Multer.File[];
      const { projectId, teamId, description, tags, fileCategory, makePublic } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Parse tags
      let parsedTags: string[] = [];
      if (tags) {
        try {
          parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (error) {
          parsedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : [];
        }
      }

      const uploadedFiles = [];
      const errors = [];

      for (const file of files) {
        try {
          // Virus scan (mock implementation)
          const virusScanStatus = await performVirusScan(file.path);
          
          if (virusScanStatus === 'infected') {
            await fs.unlink(file.path); // Delete infected file
            errors.push({
              filename: file.originalname,
              error: 'File failed virus scan',
            });
            continue;
          }

          // Generate file hash
          const fileBuffer = await fs.readFile(file.path);
          const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

          // Check for duplicates
          const existingFile = await storage.getFileByHash(hash);
          if (existingFile) {
            await fs.unlink(file.path);
            errors.push({
              filename: file.originalname,
              error: 'Duplicate file detected',
            });
            continue;
          }

          // Generate thumbnail/preview for images and PDFs
          const { thumbnailPath, previewPath } = await generatePreviews(file, hash);

          // Move file to permanent location
          const fileName = `${hash}-${Date.now()}-${file.originalname}`;
          const permanentPath = path.join('./uploads/files', fileName);
          await fs.rename(file.path, permanentPath);

          // Extract metadata
          const customMetadata = await extractFileMetadata(file, permanentPath);

          // Create file record
          const fileId = crypto.randomUUID();
          const now = new Date();
          
          const newFile = await storage.createFile({
            id: fileId,
            name: file.originalname,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            path: permanentPath,
            hash,
            projectId: projectId || null,
            uploadedBy: userId,
            description: description || null,
            tags: parsedTags,
            fileCategory: fileCategory || categorizeFile(file.mimetype),
            customMetadata,
            accessPermissions: {
              public: makePublic === 'true',
              allowDownload: true,
              allowShare: true,
              allowComment: true,
              allowEdit: false,
            },
            thumbnailPath,
            previewPath,
            virusScanStatus,
            createdAt: now,
            updatedAt: now,
          });

          // Create version history entry
          await storage.createFileVersion({
            fileId: newFile.id,
            version: 1,
            path: permanentPath,
            size: file.size,
            hash,
            uploadedBy: userId,
          });

          // Create activity log
          await storage.createActivity({
            type: 'file_uploaded',
            userId,
            resourceType: 'file',
            resourceId: newFile.id,
            teamId: teamId || null,
            projectId: projectId || null,
            metadata: {
              fileName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
            },
          });

          uploadedFiles.push(newFile);
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          errors.push({
            filename: file.originalname,
            error: 'Processing failed',
          });
          
          // Clean up file
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error('Failed to clean up file:', unlinkError);
          }
        }
      }

      res.json({
        uploaded: uploadedFiles,
        errors,
        summary: {
          total: files.length,
          successful: uploadedFiles.length,
          failed: errors.length,
        },
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  // Enhanced file search and filtering
  app.get('/api/files', isAuthenticated, async (req: any, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        projectId,
        teamId,
        mimeTypes,
        categories,
        tags,
        uploader,
        dateFrom,
        dateTo,
        sizeMin,
        sizeMax,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeArchived = false,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const filters = {
        search: search as string,
        projectId: projectId as string,
        teamId: teamId as string,
        mimeTypes: mimeTypes ? (mimeTypes as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        tags: tags ? (tags as string).split(',') : undefined,
        uploader: uploader as string,
        dateRange: dateFrom && dateTo ? {
          start: new Date(dateFrom as string),
          end: new Date(dateTo as string),
        } : undefined,
        sizeRange: sizeMin && sizeMax ? {
          min: parseInt(sizeMin as string),
          max: parseInt(sizeMax as string),
        } : undefined,
        includeArchived: includeArchived === 'true',
      };

      const sortOptions = {
        field: sortBy as any,
        direction: sortOrder as 'asc' | 'desc',
      };

      const result = await storage.getFilesAdvanced({
        limit: parseInt(limit),
        offset,
        filters,
        sort: sortOptions,
      });

      res.json({
        files: result.files,
        total: result.total,
        page: parseInt(page),
        totalPages: Math.ceil(result.total / parseInt(limit)),
        filters,
        sort: sortOptions,
      });
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Enhanced file update
  app.put('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      // Check file access permissions
      const hasAccess = await storage.checkFileAccess(fileId, userId, 'edit');
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateFileSchema.parse(req.body);
      
      const updatedFile = await storage.updateFile(fileId, {
        ...validation,
        updatedAt: new Date(),
      });

      if (!updatedFile) {
        return res.status(404).json({ message: "File not found" });
      }

      // Create activity log
      await storage.createActivity({
        type: 'file_updated',
        userId,
        resourceType: 'file',
        resourceId: fileId,
        metadata: {
          changes: validation,
        },
      });

      res.json(updatedFile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid file data", errors: error.errors });
      }
      console.error("Error updating file:", error);
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  // Bulk operations
  app.post('/api/files/bulk', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = bulkOperationSchema.parse(req.body);

      const results = [];
      const errors = [];

      for (const fileId of validation.fileIds) {
        try {
          // Check file access permissions
          const hasAccess = await storage.checkFileAccess(fileId, userId, 'edit');
          if (!hasAccess) {
            errors.push({
              fileId,
              error: 'Access denied',
            });
            continue;
          }

          let result;
          switch (validation.operation) {
            case 'delete':
              await storage.deleteFile(fileId);
              result = { fileId, operation: 'deleted' };
              break;
            case 'archive':
              await storage.updateFile(fileId, { isActive: false });
              result = { fileId, operation: 'archived' };
              break;
            case 'restore':
              await storage.updateFile(fileId, { isActive: true });
              result = { fileId, operation: 'restored' };
              break;
            case 'move':
              if (!validation.targetProjectId) {
                throw new Error('Target project ID required for move operation');
              }
              await storage.updateFile(fileId, { projectId: validation.targetProjectId });
              result = { fileId, operation: 'moved', targetProjectId: validation.targetProjectId };
              break;
            case 'copy':
              if (!validation.targetProjectId) {
                throw new Error('Target project ID required for copy operation');
              }
              const copiedFile = await storage.copyFile(fileId, validation.targetProjectId, userId);
              result = { fileId, operation: 'copied', newFileId: copiedFile.id };
              break;
            default:
              throw new Error(`Unknown operation: ${validation.operation}`);
          }

          results.push(result);

          // Create activity log
          await storage.createActivity({
            type: `file_${validation.operation}`,
            userId,
            resourceType: 'file',
            resourceId: fileId,
            metadata: {
              operation: validation.operation,
              targetProjectId: validation.targetProjectId,
              targetTeamId: validation.targetTeamId,
            },
          });
        } catch (error) {
          console.error(`Error processing file ${fileId}:`, error);
          errors.push({
            fileId,
            error: (error as Error).message,
          });
        }
      }

      res.json({
        results,
        errors,
        summary: {
          total: validation.fileIds.length,
          successful: results.length,
          failed: errors.length,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk operation data", errors: error.errors });
      }
      console.error("Error performing bulk operation:", error);
      res.status(500).json({ message: "Failed to perform bulk operation" });
    }
  });

  // File sharing
  app.post('/api/files/:id/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      // Check file access permissions
      const hasAccess = await storage.checkFileAccess(fileId, userId, 'share');
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = shareFileSchema.parse(req.body);

      const shareLink = await storage.createShareLink({
        fileId,
        createdBy: userId,
        token: generateShareToken(),
        expiresAt: validation.expiresAt ? new Date(validation.expiresAt) : null,
        maxDownloads: validation.maxDownloads || null,
        password: validation.password || null,
        permissions: validation.permissions,
      });

      // Create activity log
      await storage.createActivity({
        type: 'file_shared',
        userId,
        resourceType: 'file',
        resourceId: fileId,
        metadata: {
          shareId: shareLink.id,
          permissions: validation.permissions,
          hasPassword: !!validation.password,
          expiresAt: validation.expiresAt,
        },
      });

      res.json(shareLink);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid share data", errors: error.errors });
      }
      console.error("Error sharing file:", error);
      res.status(500).json({ message: "Failed to share file" });
    }
  });

  // File analytics
  app.get('/api/files/:id/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      // Check file access permissions
      const hasAccess = await storage.checkFileAccess(fileId, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const analytics = await storage.getFileAnalytics(fileId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching file analytics:", error);
      res.status(500).json({ message: "Failed to fetch file analytics" });
    }
  });
}

// Helper functions

async function performVirusScan(filePath: string): Promise<'pending' | 'clean' | 'infected' | 'failed'> {
  // Mock virus scan - in production, integrate with actual virus scanning service
  try {
    // Simulate scan time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simple check for suspicious file names or extensions
    const suspiciousPatterns = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.jar'];
    const filename = path.basename(filePath).toLowerCase();
    
    for (const pattern of suspiciousPatterns) {
      if (filename.includes(pattern)) {
        return 'infected';
      }
    }
    
    return 'clean';
  } catch (error) {
    console.error('Virus scan failed:', error);
    return 'failed';
  }
}

async function generatePreviews(file: Express.Multer.File, hash: string): Promise<{ thumbnailPath?: string; previewPath?: string }> {
  // Mock preview generation - in production, use proper image/document processing libraries
  try {
    if (file.mimetype.startsWith('image/')) {
      // For images, generate thumbnail and preview
      const thumbnailPath = `./uploads/thumbnails/${hash}-thumb.jpg`;
      const previewPath = `./uploads/previews/${hash}-preview.jpg`;
      
      // Mock generation
      await fs.mkdir('./uploads/thumbnails', { recursive: true });
      await fs.mkdir('./uploads/previews', { recursive: true });
      
      // In production: use sharp, jimp, or similar library to generate actual thumbnails
      
      return { thumbnailPath, previewPath };
    }
    
    if (file.mimetype === 'application/pdf') {
      // For PDFs, generate preview images
      const previewPath = `./uploads/previews/${hash}-preview.png`;
      
      await fs.mkdir('./uploads/previews', { recursive: true });
      
      // In production: use pdf2pic, pdf-poppler, or similar library
      
      return { previewPath };
    }
    
    return {};
  } catch (error) {
    console.error('Preview generation failed:', error);
    return {};
  }
}

async function extractFileMetadata(file: Express.Multer.File, filePath: string): Promise<Record<string, any>> {
  try {
    const metadata: Record<string, any> = {
      originalSize: file.size,
      encoding: file.encoding || 'unknown',
      uploadedAt: new Date().toISOString(),
    };

    // Extract EXIF data for images
    if (file.mimetype.startsWith('image/')) {
      // In production: use exif-parser, piexifjs, or similar library
      metadata.imageInfo = {
        type: 'image',
        format: file.mimetype.split('/')[1],
      };
    }

    // Extract document properties for office files
    if (file.mimetype.includes('officedocument') || file.mimetype.includes('msword')) {
      metadata.documentInfo = {
        type: 'document',
        format: file.mimetype,
      };
    }

    return metadata;
  } catch (error) {
    console.error('Metadata extraction failed:', error);
    return {};
  }
}

function categorizeFile(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('document') || mimeType.includes('pdf') || mimeType.includes('text')) return 'document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'archive';
  return 'other';
}

function generateShareToken(): string {
  return `share_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}