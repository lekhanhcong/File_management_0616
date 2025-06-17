// Optimized database schema with performance indexes
// Enhanced schema based on performance audit

import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  uuid,
  bigint,
  uniqueIndex,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enhanced users table with performance indexes
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["admin", "manager", "user"] }).default("user").notNull(),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_email").on(table.email),
  index("idx_users_role").on(table.role),
  index("idx_users_active").on(table.isActive),
  index("idx_users_created_at").on(table.createdAt),
]);

// Enhanced organizations table
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_organizations_slug").on(table.slug),
  index("idx_organizations_active").on(table.isActive),
]);

// Enhanced projects table with better indexing
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_projects_org_id").on(table.organizationId),
  index("idx_projects_created_by").on(table.createdBy),
  index("idx_projects_active").on(table.isActive),
  index("idx_projects_created_at").on(table.createdAt),
  index("idx_projects_org_active").on(table.organizationId, table.isActive),
]);

// Optimized files table with comprehensive indexing
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  path: text("path").notNull(),
  hash: varchar("hash", { length: 64 }),
  projectId: uuid("project_id").references(() => projects.id),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  description: text("description"),
  tags: jsonb("tags").$type<string[]>().default([]),
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),
  isOfflineAvailable: boolean("is_offline_available").default(false),
  downloadCount: integer("download_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Primary search indexes
  index("idx_files_uploaded_by").on(table.uploadedBy),
  index("idx_files_project_id").on(table.projectId),
  index("idx_files_mime_type").on(table.mimeType),
  index("idx_files_is_active").on(table.isActive),
  
  // Composite indexes for common queries
  index("idx_files_user_active").on(table.uploadedBy, table.isActive),
  index("idx_files_project_active").on(table.projectId, table.isActive),
  index("idx_files_created_at").on(table.createdAt),
  index("idx_files_updated_at").on(table.updatedAt),
  
  // Search optimization indexes
  index("idx_files_name_search").on(table.name),
  index("idx_files_original_name_search").on(table.originalName),
  
  // Performance indexes
  index("idx_files_size").on(table.size),
  index("idx_files_download_count").on(table.downloadCount),
  index("idx_files_hash").on(table.hash),
  
  // Full-text search index (PostgreSQL specific)
  // index("idx_files_fulltext").using("gin", sql`(to_tsvector('english', name || ' ' || coalesce(description, '')))`),
]);

// Enhanced file versions with indexing
export const fileVersions = pgTable("file_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  path: text("path").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  hash: varchar("hash", { length: 64 }),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_file_versions_file_id").on(table.fileId),
  index("idx_file_versions_uploaded_by").on(table.uploadedBy),
  index("idx_file_versions_version").on(table.version),
  index("idx_file_versions_created_at").on(table.createdAt),
  uniqueIndex("idx_file_versions_unique").on(table.fileId, table.version),
]);

// Enhanced file permissions with indexing
export const filePermissions = pgTable("file_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  permission: varchar("permission", { enum: ["read", "write", "admin"] }).notNull(),
  grantedBy: varchar("granted_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_file_permissions_file_id").on(table.fileId),
  index("idx_file_permissions_user_id").on(table.userId),
  index("idx_file_permissions_granted_by").on(table.grantedBy),
  index("idx_file_permissions_active").on(table.isActive),
  index("idx_file_permissions_expires_at").on(table.expiresAt),
  uniqueIndex("idx_file_permissions_unique").on(table.fileId, table.userId),
]);

// Enhanced audit logs with partitioning-ready structure
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: varchar("resource_id"),
  userId: varchar("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  severity: varchar("severity", { enum: ["low", "medium", "high", "critical"] }).default("low"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_user_id").on(table.userId),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_resource_type").on(table.resourceType),
  index("idx_audit_logs_resource_id").on(table.resourceId),
  index("idx_audit_logs_created_at").on(table.createdAt),
  index("idx_audit_logs_severity").on(table.severity),
  index("idx_audit_logs_ip_address").on(table.ipAddress),
]);

// Enhanced share links with better indexing
export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  downloadCount: integer("download_count").default(0),
  maxDownloads: integer("max_downloads"),
  password: varchar("password"),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_share_links_token").on(table.token),
  index("idx_share_links_file_id").on(table.fileId),
  index("idx_share_links_created_by").on(table.createdBy),
  index("idx_share_links_expires_at").on(table.expiresAt),
  index("idx_share_links_active").on(table.isActive),
  index("idx_share_links_created_at").on(table.createdAt),
]);

// New table for caching frequently accessed data
export const queryCache = pgTable("query_cache", {
  id: serial("id").primaryKey(),
  cacheKey: varchar("cache_key", { length: 255 }).notNull().unique(),
  data: jsonb("data").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_query_cache_key").on(table.cacheKey),
  index("idx_query_cache_expires_at").on(table.expiresAt),
]);

// New table for tracking user sessions and activity
export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_sessions_token").on(table.sessionToken),
  index("idx_user_sessions_user_id").on(table.userId),
  index("idx_user_sessions_expires_at").on(table.expiresAt),
  index("idx_user_sessions_active").on(table.isActive),
  index("idx_user_sessions_last_activity").on(table.lastActivityAt),
]);

// Keep all existing relations
export const usersRelations = relations(users, ({ many }) => ({
  files: many(files),
  projects: many(projects),
  auditLogs: many(auditLogs),
  filePermissions: many(filePermissions),
  shareLinks: many(shareLinks),
  sessions: many(userSessions),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  files: many(files),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  project: one(projects, {
    fields: [files.projectId],
    references: [projects.id],
  }),
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
  versions: many(fileVersions),
  permissions: many(filePermissions),
  shareLinks: many(shareLinks),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(files, {
    fields: [fileVersions.fileId],
    references: [files.id],
  }),
  uploader: one(users, {
    fields: [fileVersions.uploadedBy],
    references: [users.id],
  }),
}));

export const filePermissionsRelations = relations(filePermissions, ({ one }) => ({
  file: one(files, {
    fields: [filePermissions.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [filePermissions.userId],
    references: [users.id],
  }),
  grantor: one(users, {
    fields: [filePermissions.grantedBy],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  file: one(files, {
    fields: [shareLinks.fileId],
    references: [files.id],
  }),
  creator: one(users, {
    fields: [shareLinks.createdBy],
    references: [users.id],
  }),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// Enhanced insert schemas with validation
export const insertOrganizationSchema = createInsertSchema(organizations)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  });

export const insertProjectSchema = createInsertSchema(projects)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
  });

export const insertFileSchema = createInsertSchema(files)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1).max(255),
    originalName: z.string().min(1).max(255),
    size: z.number().min(0).max(100 * 1024 * 1024), // 100MB max
    tags: z.array(z.string()).max(20).optional(),
  });

// Export all types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type FileVersion = typeof fileVersions.$inferSelect;
export type FilePermission = typeof filePermissions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;

// Enhanced types with relations and performance metadata
export type FileWithDetails = File & {
  uploader: User;
  project?: Project;
  permissions?: FilePermission[];
  versions?: FileVersion[];
  _cached?: boolean;
  _loadTime?: number;
};

export type ProjectWithDetails = Project & {
  creator: User;
  organization?: Organization;
  files?: File[];
  _fileCount?: number;
  _totalSize?: number;
};