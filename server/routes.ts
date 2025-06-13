import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertFileSchema, insertProjectSchema, insertAuditLogSchema } from "@shared/schema";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  dest: "./uploads/temp",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Ensure upload directories exist
async function ensureDirectories() {
  const dirs = ["./uploads/temp", "./uploads/files"];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dir}:`, error);
    }
  }
}

// Audit logging helper
async function createAuditLog(
  action: string,
  resourceType: string,
  resourceId: string,
  userId: string,
  req: any,
  details?: any
) {
  try {
    await storage.createAuditLog({
      action,
      resourceType,
      resourceId,
      userId,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      details,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureDirectories();
  
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // File routes
  app.post('/api/files/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;
      const { projectId, description, tags } = req.body;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Generate file hash
      const fileBuffer = await fs.readFile(file.path);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Move file to permanent location
      const fileName = `${hash}-${Date.now()}-${file.originalname}`;
      const permanentPath = path.join('./uploads/files', fileName);
      await fs.rename(file.path, permanentPath);

      // Parse tags
      let parsedTags: string[] = [];
      if (tags) {
        try {
          parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (error) {
          parsedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : [];
        }
      }

      // Create file record
      const newFile = await storage.createFile({
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
      });

      // Create audit log
      await createAuditLog('file_upload', 'file', newFile.id, userId, req, {
        fileName: file.originalname,
        fileSize: file.size,
        projectId,
      });

      res.json(newFile);
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get('/api/files', isAuthenticated, async (req: any, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        projectId,
        mimeTypes,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const result = await storage.getFiles({
        limit: parseInt(limit),
        offset,
        search: search as string,
        projectId: projectId as string,
        mimeTypes: mimeTypes ? (mimeTypes as string).split(',') : undefined,
      });

      res.json({
        files: result.files,
        total: result.total,
        page: parseInt(page),
        totalPages: Math.ceil(result.total / parseInt(limit)),
      });
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  app.get('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const file = await storage.getFile(req.params.id);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      res.json(file);
    } catch (error) {
      console.error("Error fetching file:", error);
      res.status(500).json({ message: "Failed to fetch file" });
    }
  });

  app.get('/api/files/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = await storage.getFile(req.params.id);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check if file exists
      try {
        await fs.access(file.path);
      } catch (error) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      // Create audit log
      await createAuditLog('file_download', 'file', file.id, userId, req);

      // Set headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimeType);
      
      // Stream file
      const fileBuffer = await fs.readFile(file.path);
      res.send(fileBuffer);
    } catch (error) {
      console.error("File download error:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  app.put('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, tags, isOfflineAvailable } = req.body;
      
      const updatedFile = await storage.updateFile(req.params.id, {
        name,
        description,
        tags,
        isOfflineAvailable,
      });

      if (!updatedFile) {
        return res.status(404).json({ message: "File not found" });
      }

      // Create audit log
      await createAuditLog('file_update', 'file', updatedFile.id, userId, req, {
        changes: { name, description, tags, isOfflineAvailable },
      });

      res.json(updatedFile);
    } catch (error) {
      console.error("Error updating file:", error);
      res.status(500).json({ message: "Failed to update file" });
    }
  });

  app.delete('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = await storage.getFile(req.params.id);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      await storage.deleteFile(req.params.id);

      // Create audit log
      await createAuditLog('file_delete', 'file', file.id, userId, req, {
        fileName: file.originalName,
      });

      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Project routes
  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = insertProjectSchema.parse({
        ...req.body,
        createdBy: userId,
      });

      const project = await storage.createProject(validation);

      // Create audit log
      await createAuditLog('project_create', 'project', project.id, userId, req, {
        projectName: project.name,
      });

      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        organizationId,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const result = await storage.getProjects({
        limit: parseInt(limit),
        offset,
        organizationId: organizationId as string,
      });

      res.json({
        projects: result.projects,
        total: result.total,
        page: parseInt(page),
        totalPages: Math.ceil(result.total / parseInt(limit)),
      });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Audit log routes
  app.get('/api/audit-logs', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const {
        page = 1,
        limit = 50,
        userId,
        resourceType,
        resourceId,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const result = await storage.getAuditLogs({
        limit: parseInt(limit),
        offset,
        userId: userId as string,
        resourceType: resourceType as string,
        resourceId: resourceId as string,
      });

      res.json({
        logs: result.logs,
        total: result.total,
        page: parseInt(page),
        totalPages: Math.ceil(result.total / parseInt(limit)),
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Recent files endpoint
  app.get('/api/files/recent', isAuthenticated, async (req: any, res) => {
    try {
      const result = await storage.getFiles({
        limit: 6,
        offset: 0,
      });

      res.json(result.files);
    } catch (error) {
      console.error("Error fetching recent files:", error);
      res.status(500).json({ message: "Failed to fetch recent files" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket connection established');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data);

        // Handle different message types
        switch (data.type) {
          case 'file_activity':
            // Broadcast file activity to all connected clients
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'file_activity',
                  data: data.payload,
                  timestamp: new Date().toISOString(),
                }));
              }
            });
            break;
          
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to File Management System',
      timestamp: new Date().toISOString(),
    }));
  });

  return httpServer;
}
