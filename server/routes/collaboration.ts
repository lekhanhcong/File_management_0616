import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

// Collaboration validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  position: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    page: z.number().optional(),
    selection: z.object({
      start: z.number(),
      end: z.number(),
    }).optional(),
  }).optional(),
  parentId: z.string().uuid().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

const resolveCommentSchema = z.object({
  isResolved: z.boolean(),
});

export function registerCollaborationRoutes(app: Express) {
  // Start collaboration session
  app.post('/api/files/:id/collaborate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      // Check file access permissions
      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Check if user has access to the file
      const hasAccess = await storage.checkFileAccess(fileId, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create or update collaboration session
      const session = await storage.createOrUpdateCollaborationSession({
        fileId,
        userId,
        sessionToken: generateSessionToken(),
        isActive: true,
        lastActivity: new Date(),
      });

      res.json(session);
    } catch (error) {
      console.error("Error starting collaboration:", error);
      res.status(500).json({ message: "Failed to start collaboration" });
    }
  });

  // Get active collaboration sessions for a file
  app.get('/api/files/:id/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      // Check file access permissions
      const hasAccess = await storage.checkFileAccess(fileId, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const sessions = await storage.getActiveCollaborationSessions(fileId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  // End collaboration session
  app.delete('/api/files/:id/collaborate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      await storage.endCollaborationSession(fileId, userId);
      res.json({ message: "Collaboration session ended" });
    } catch (error) {
      console.error("Error ending collaboration:", error);
      res.status(500).json({ message: "Failed to end collaboration" });
    }
  });

  // File Comments API

  // Create comment
  app.post('/api/files/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      // Check file access permissions
      const hasAccess = await storage.checkFileAccess(fileId, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = createCommentSchema.parse(req.body);

      const comment = await storage.createFileComment({
        fileId,
        userId,
        ...validation,
      });

      // Create activity log
      await storage.createActivity({
        type: 'comment_created',
        userId,
        resourceType: 'file',
        resourceId: fileId,
        metadata: {
          commentId: comment.id,
          hasPosition: !!validation.position,
        },
      });

      res.json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Get file comments
  app.get('/api/files/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = req.params.id;

      // Check file access permissions
      const hasAccess = await storage.checkFileAccess(fileId, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const {
        page = 1,
        limit = 50,
        resolved,
        parentId,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const comments = await storage.getFileComments(fileId, {
        limit: parseInt(limit),
        offset,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        parentId: parentId as string,
      });

      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Update comment
  app.put('/api/comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const commentId = req.params.id;

      const comment = await storage.getFileComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Only comment author can update
      if (comment.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = updateCommentSchema.parse(req.body);

      const updatedComment = await storage.updateFileComment(commentId, validation);
      res.json(updatedComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      console.error("Error updating comment:", error);
      res.status(500).json({ message: "Failed to update comment" });
    }
  });

  // Resolve/unresolve comment
  app.patch('/api/comments/:id/resolve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const commentId = req.params.id;

      const comment = await storage.getFileComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Check file access permissions
      const hasAccess = await storage.checkFileAccess(comment.fileId, userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = resolveCommentSchema.parse(req.body);

      const updatedComment = await storage.updateFileComment(commentId, {
        isResolved: validation.isResolved,
        resolvedBy: validation.isResolved ? userId : null,
        resolvedAt: validation.isResolved ? new Date() : null,
      });

      // Create activity log
      await storage.createActivity({
        type: validation.isResolved ? 'comment_resolved' : 'comment_reopened',
        userId,
        resourceType: 'file',
        resourceId: comment.fileId,
        metadata: {
          commentId: comment.id,
        },
      });

      res.json(updatedComment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid resolve data", errors: error.errors });
      }
      console.error("Error resolving comment:", error);
      res.status(500).json({ message: "Failed to resolve comment" });
    }
  });

  // Delete comment
  app.delete('/api/comments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const commentId = req.params.id;

      const comment = await storage.getFileComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // Only comment author or file owner can delete
      const file = await storage.getFile(comment.fileId);
      if (comment.userId !== userId && file?.uploadedBy !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteFileComment(commentId);

      // Create activity log
      await storage.createActivity({
        type: 'comment_deleted',
        userId,
        resourceType: 'file',
        resourceId: comment.fileId,
        metadata: {
          commentId: comment.id,
        },
      });

      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Error deleting comment:", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  // Activity Feed

  // Get activity feed
  app.get('/api/activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        page = 1,
        limit = 20,
        teamId,
        projectId,
        type,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const activities = await storage.getActivityFeed(userId, {
        limit: parseInt(limit),
        offset,
        teamId: teamId as string,
        projectId: projectId as string,
        type: type as string,
      });

      res.json({
        activities,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error("Error fetching activity feed:", error);
      res.status(500).json({ message: "Failed to fetch activity feed" });
    }
  });

  // Get team activity
  app.get('/api/teams/:id/activity', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const teamId = req.params.id;

      // Check if user is member of the team
      const membership = await storage.getTeamMembership(teamId, userId);
      if (!membership) {
        return res.status(403).json({ message: "Access denied" });
      }

      const {
        page = 1,
        limit = 20,
        type,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      const activities = await storage.getTeamActivity(teamId, {
        limit: parseInt(limit),
        offset,
        type: type as string,
      });

      res.json({
        activities,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    } catch (error) {
      console.error("Error fetching team activity:", error);
      res.status(500).json({ message: "Failed to fetch team activity" });
    }
  });
}

function generateSessionToken(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}