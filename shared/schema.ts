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
} from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText, integer as sqliteInteger } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { enum: ["admin", "manager", "user"] }).default("user").notNull(),
  jobTitle: varchar("job_title", { length: 100 }),
  department: varchar("department", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  timezone: varchar("timezone", { length: 50 }),
  language: varchar("language", { length: 10 }).default("en"),
  preferences: jsonb("preferences").$type<UserPreferences>(),
  lastLoginAt: timestamp("last_login_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organizations/Teams
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Files
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
  fileCategory: varchar("file_category", { length: 50 }),
  customMetadata: jsonb("custom_metadata").$type<Record<string, any>>(),
  accessPermissions: jsonb("access_permissions").$type<FileAccessPermissions>(),
  versionHistory: jsonb("version_history").$type<FileVersionInfo[]>(),
  thumbnailPath: text("thumbnail_path"),
  previewPath: text("preview_path"),
  expiresAt: timestamp("expires_at"),
  downloadCount: integer("download_count").default(0),
  viewCount: integer("view_count").default(0),
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),
  isOfflineAvailable: boolean("is_offline_available").default(false),
  isEncrypted: boolean("is_encrypted").default(false),
  virusScanStatus: varchar("virus_scan_status", { enum: ["pending", "clean", "infected", "failed"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// File versions for version control
export const fileVersions = pgTable("file_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  version: integer("version").notNull(),
  path: text("path").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  hash: varchar("hash", { length: 64 }),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// File permissions
export const filePermissions = pgTable("file_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  permission: varchar("permission", { enum: ["read", "write", "admin"] }).notNull(),
  grantedBy: varchar("granted_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: varchar("resource_id"),
  userId: varchar("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  avatarUrl: varchar("avatar_url"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  settings: jsonb("settings").$type<TeamSettings>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Team members table
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { enum: ["owner", "admin", "member", "viewer"] }).default("member").notNull(),
  permissions: jsonb("permissions").$type<TeamMemberPermissions>(),
  invitedBy: varchar("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Team invitations
export const teamInvitations = pgTable("team_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { enum: ["admin", "member", "viewer"] }).default("member").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  invitedBy: varchar("invited_by").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  status: varchar("status", { enum: ["pending", "accepted", "declined", "expired"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Collaboration sessions
export const collaborationSessions = pgTable("collaboration_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  isActive: boolean("is_active").default(true),
  lastActivity: timestamp("last_activity").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Comments on files
export const fileComments = pgTable("file_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  position: jsonb("position").$type<CommentPosition>(),
  isResolved: boolean("is_resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity feed
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: varchar("resource_id").notNull(),
  teamId: uuid("team_id").references(() => teams.id),
  projectId: uuid("project_id").references(() => projects.id),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Share links
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
  permissions: varchar("permissions", { enum: ["view", "download", "comment"] }).default("view"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  files: many(files),
  projects: many(projects),
  auditLogs: many(auditLogs),
  filePermissions: many(filePermissions),
  shareLinks: many(shareLinks),
  teamMemberships: many(teamMembers),
  teamInvitations: many(teamInvitations),
  collaborationSessions: many(collaborationSessions),
  fileComments: many(fileComments),
  activities: many(activities),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [teams.createdBy],
    references: [users.id],
  }),
  members: many(teamMembers),
  invitations: many(teamInvitations),
  projects: many(projects),
  activities: many(activities),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [teamMembers.invitedBy],
    references: [users.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  inviter: one(users, {
    fields: [teamInvitations.invitedBy],
    references: [users.id],
  }),
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
  activities: many(activities),
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
  collaborationSessions: many(collaborationSessions),
  comments: many(fileComments),
}));

export const collaborationSessionsRelations = relations(collaborationSessions, ({ one }) => ({
  file: one(files, {
    fields: [collaborationSessions.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [collaborationSessions.userId],
    references: [users.id],
  }),
}));

export const fileCommentsRelations = relations(fileComments, ({ one, many }) => ({
  file: one(files, {
    fields: [fileComments.fileId],
    references: [files.id],
  }),
  user: one(users, {
    fields: [fileComments.userId],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [fileComments.resolvedBy],
    references: [users.id],
  }),
  parent: one(fileComments, {
    fields: [fileComments.parentId],
    references: [fileComments.id],
  }),
  replies: many(fileComments),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [activities.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
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

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileVersionSchema = createInsertSchema(fileVersions).omit({
  id: true,
  createdAt: true,
});

export const insertFilePermissionSchema = createInsertSchema(filePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertShareLinkSchema = createInsertSchema(shareLinks).omit({
  id: true,
  createdAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({
  id: true,
  createdAt: true,
});

export const insertCollaborationSessionSchema = createInsertSchema(collaborationSessions).omit({
  id: true,
  createdAt: true,
});

export const insertFileCommentSchema = createInsertSchema(fileComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

// Note: Insert types are defined below using $inferInsert

// Type definitions for complex fields
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    mentions: boolean;
    fileChanges: boolean;
  };
  defaultView: 'list' | 'grid' | 'kanban';
  autoSave: boolean;
}

export interface FileAccessPermissions {
  public: boolean;
  allowDownload: boolean;
  allowShare: boolean;
  allowComment: boolean;
  allowEdit: boolean;
  expiresAt?: string;
}

export interface FileVersionInfo {
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  size: number;
  changelog?: string;
}

export interface TeamSettings {
  defaultFilePermissions: FileAccessPermissions;
  allowGuestAccess: boolean;
  maxFileSize: number;
  allowedFileTypes: string[];
  autoDeleteInactive: boolean;
  inactivityPeriod: number;
}

export interface TeamMemberPermissions {
  manageMembers: boolean;
  manageFiles: boolean;
  manageProjects: boolean;
  manageSettings: boolean;
  viewAnalytics: boolean;
}

export interface CommentPosition {
  x?: number;
  y?: number;
  page?: number;
  selection?: {
    start: number;
    end: number;
  };
}

// Basic types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type FileVersion = typeof fileVersions.$inferSelect;
export type InsertFileVersion = z.infer<typeof insertFileVersionSchema>;
export type FilePermission = typeof filePermissions.$inferSelect;
export type InsertFilePermission = z.infer<typeof insertFilePermissionSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = typeof teamInvitations.$inferInsert;
export type CollaborationSession = typeof collaborationSessions.$inferSelect;
export type InsertCollaborationSession = typeof collaborationSessions.$inferInsert;
export type FileComment = typeof fileComments.$inferSelect;
export type InsertFileComment = typeof fileComments.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

// Enhanced types with relations
export type FileWithDetails = File & {
  uploader: User;
  project?: Project;
  permissions?: FilePermission[];
  versions?: FileVersion[];
  comments?: FileComment[];
  collaborationSessions?: CollaborationSession[];
  shareLinks?: ShareLink[];
};

export type ProjectWithDetails = Project & {
  creator: User;
  organization?: Organization;
  files?: File[];
  activities?: Activity[];
};

export type TeamWithDetails = Team & {
  creator: User;
  organization?: Organization;
  members?: (TeamMember & { user: User })[];
  projects?: Project[];
  invitations?: TeamInvitation[];
};

export type UserWithDetails = User & {
  teamMemberships?: (TeamMember & { team: Team })[];
  files?: File[];
  projects?: Project[];
};

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FileFilters {
  search?: string;
  fileTypes?: string[];
  categories?: string[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  uploader?: string;
  project?: string;
  team?: string;
}

export interface SortOptions {
  field: 'name' | 'size' | 'createdAt' | 'updatedAt' | 'downloadCount' | 'viewCount';
  direction: 'asc' | 'desc';
}
