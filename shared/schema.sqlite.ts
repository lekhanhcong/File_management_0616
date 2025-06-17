import { sqliteTable, text, integer, blob, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  profileImageUrl: text('profile_image_url'),
  role: text('role'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name'),
  slug: text('slug'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name'),
  description: text('description'),
  organizationId: text('organization_id'),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
  name: text('name'),
  originalName: text('original_name'),
  mimeType: text('mime_type'),
  size: integer('size'),
  path: text('path'),
  hash: text('hash'),
  projectId: text('project_id'),
  uploadedBy: text('uploaded_by'),
  description: text('description'),
  tags: text('tags'), // store as JSON string
  version: integer('version'),
  isActive: integer('is_active'),
  isOfflineAvailable: integer('is_offline_available'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const fileVersions = sqliteTable('file_versions', {
  id: text('id').primaryKey(),
  fileId: text('file_id'),
  version: integer('version'),
  path: text('path'),
  size: integer('size'),
  hash: text('hash'),
  uploadedBy: text('uploaded_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const filePermissions = sqliteTable('file_permissions', {
  id: text('id').primaryKey(),
  fileId: text('file_id'),
  userId: text('user_id'),
  permission: text('permission'),
  grantedBy: text('granted_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  userId: text('user_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  details: text('details'), // store as JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const shareLinks = sqliteTable('share_links', {
  id: text('id').primaryKey(),
  token: text('token'),
  fileId: text('file_id'),
  createdBy: text('created_by'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  isActive: integer('is_active'),
  downloadCount: integer('download_count'),
  maxDownloads: integer('max_downloads'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
}); 