import { z } from 'zod';

export const insertFileSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  path: z.string(),
  hash: z.string(),
  projectId: z.string().optional(),
  uploadedBy: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  version: z.number().optional(),
  isActive: z.number().optional(),
  isOfflineAvailable: z.number().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const insertProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  organizationId: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const insertAuditLogSchema = z.object({
  id: z.string().optional(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  userId: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  details: z.string().optional(),
  createdAt: z.number().optional(),
}); 