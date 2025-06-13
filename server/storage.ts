import {
  users,
  files,
  projects,
  organizations,
  fileVersions,
  filePermissions,
  auditLogs,
  shareLinks,
  type User,
  type UpsertUser,
  type File,
  type InsertFile,
  type FileWithDetails,
  type Project,
  type InsertProject,
  type ProjectWithDetails,
  type Organization,
  type InsertOrganization,
  type FileVersion,
  type InsertFileVersion,
  type FilePermission,
  type InsertFilePermission,
  type AuditLog,
  type InsertAuditLog,
  type ShareLink,
  type InsertShareLink,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, ilike, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // File operations
  createFile(file: InsertFile): Promise<File>;
  getFile(id: string): Promise<FileWithDetails | undefined>;
  getFiles(options?: {
    projectId?: string;
    uploadedBy?: string;
    limit?: number;
    offset?: number;
    search?: string;
    mimeTypes?: string[];
  }): Promise<{ files: FileWithDetails[]; total: number }>;
  updateFile(id: string, updates: Partial<InsertFile>): Promise<File | undefined>;
  deleteFile(id: string): Promise<boolean>;
  
  // File version operations
  createFileVersion(version: InsertFileVersion): Promise<FileVersion>;
  getFileVersions(fileId: string): Promise<FileVersion[]>;
  
  // Project operations
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<ProjectWithDetails | undefined>;
  getProjects(options?: {
    createdBy?: string;
    organizationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ projects: ProjectWithDetails[]; total: number }>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
  
  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizations(): Promise<Organization[]>;
  
  // Permission operations
  createFilePermission(permission: InsertFilePermission): Promise<FilePermission>;
  getFilePermissions(fileId: string): Promise<FilePermission[]>;
  getUserFilePermission(fileId: string, userId: string): Promise<FilePermission | undefined>;
  deleteFilePermission(id: string): Promise<boolean>;
  
  // Audit operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(options?: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }>;
  
  // Share link operations
  createShareLink(shareLink: InsertShareLink): Promise<ShareLink>;
  getShareLink(token: string): Promise<ShareLink | undefined>;
  getShareLinksByFile(fileId: string): Promise<ShareLink[]>;
  updateShareLink(id: string, updates: Partial<InsertShareLink>): Promise<ShareLink | undefined>;
  deleteShareLink(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // File operations
  async createFile(file: InsertFile): Promise<File> {
    const [newFile] = await db.insert(files).values(file).returning();
    return newFile;
  }

  async getFile(id: string): Promise<FileWithDetails | undefined> {
    const [file] = await db
      .select({
        id: files.id,
        name: files.name,
        originalName: files.originalName,
        mimeType: files.mimeType,
        size: files.size,
        path: files.path,
        hash: files.hash,
        projectId: files.projectId,
        uploadedBy: files.uploadedBy,
        description: files.description,
        tags: files.tags,
        version: files.version,
        isActive: files.isActive,
        isOfflineAvailable: files.isOfflineAvailable,
        createdAt: files.createdAt,
        updatedAt: files.updatedAt,
        uploader: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        project: {
          id: projects.id,
          name: projects.name,
          description: projects.description,
          organizationId: projects.organizationId,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
      })
      .from(files)
      .leftJoin(users, eq(files.uploadedBy, users.id))
      .leftJoin(projects, eq(files.projectId, projects.id))
      .where(and(eq(files.id, id), eq(files.isActive, true)));

    return file as FileWithDetails | undefined;
  }

  async getFiles(options: {
    projectId?: string;
    uploadedBy?: string;
    limit?: number;
    offset?: number;
    search?: string;
    mimeTypes?: string[];
  } = {}): Promise<{ files: FileWithDetails[]; total: number }> {
    const { projectId, uploadedBy, limit = 20, offset = 0, search, mimeTypes } = options;

    let whereClause = and(eq(files.isActive, true));
    
    if (projectId) {
      whereClause = and(whereClause, eq(files.projectId, projectId));
    }
    
    if (uploadedBy) {
      whereClause = and(whereClause, eq(files.uploadedBy, uploadedBy));
    }
    
    if (search) {
      whereClause = and(
        whereClause,
        or(
          ilike(files.name, `%${search}%`),
          ilike(files.originalName, `%${search}%`),
          ilike(files.description, `%${search}%`)
        )
      );
    }
    
    if (mimeTypes && mimeTypes.length > 0) {
      whereClause = and(whereClause, inArray(files.mimeType, mimeTypes));
    }

    const [filesResult, countResult] = await Promise.all([
      db
        .select({
          id: files.id,
          name: files.name,
          originalName: files.originalName,
          mimeType: files.mimeType,
          size: files.size,
          path: files.path,
          hash: files.hash,
          projectId: files.projectId,
          uploadedBy: files.uploadedBy,
          description: files.description,
          tags: files.tags,
          version: files.version,
          isActive: files.isActive,
          isOfflineAvailable: files.isOfflineAvailable,
          createdAt: files.createdAt,
          updatedAt: files.updatedAt,
          uploader: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
          project: {
            id: projects.id,
            name: projects.name,
            description: projects.description,
            organizationId: projects.organizationId,
            createdBy: projects.createdBy,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          },
        })
        .from(files)
        .leftJoin(users, eq(files.uploadedBy, users.id))
        .leftJoin(projects, eq(files.projectId, projects.id))
        .where(whereClause)
        .orderBy(desc(files.updatedAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(files)
        .where(whereClause),
    ]);

    return {
      files: filesResult as FileWithDetails[],
      total: countResult[0]?.count || 0,
    };
  }

  async updateFile(id: string, updates: Partial<InsertFile>): Promise<File | undefined> {
    const [file] = await db
      .update(files)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    return file;
  }

  async deleteFile(id: string): Promise<boolean> {
    const [file] = await db
      .update(files)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    return !!file;
  }

  // File version operations
  async createFileVersion(version: InsertFileVersion): Promise<FileVersion> {
    const [newVersion] = await db.insert(fileVersions).values(version).returning();
    return newVersion;
  }

  async getFileVersions(fileId: string): Promise<FileVersion[]> {
    return await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.version));
  }

  // Project operations
  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async getProject(id: string): Promise<ProjectWithDetails | undefined> {
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        organizationId: projects.organizationId,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        creator: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
        organization: {
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
        },
      })
      .from(projects)
      .leftJoin(users, eq(projects.createdBy, users.id))
      .leftJoin(organizations, eq(projects.organizationId, organizations.id))
      .where(eq(projects.id, id));

    return project as ProjectWithDetails | undefined;
  }

  async getProjects(options: {
    createdBy?: string;
    organizationId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ projects: ProjectWithDetails[]; total: number }> {
    const { createdBy, organizationId, limit = 20, offset = 0 } = options;

    let whereClause = sql`1=1`;
    
    if (createdBy) {
      whereClause = and(whereClause, eq(projects.createdBy, createdBy));
    }
    
    if (organizationId) {
      whereClause = and(whereClause, eq(projects.organizationId, organizationId));
    }

    const [projectsResult, countResult] = await Promise.all([
      db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          organizationId: projects.organizationId,
          createdBy: projects.createdBy,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
          creator: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          },
          organization: {
            id: organizations.id,
            name: organizations.name,
            slug: organizations.slug,
            createdAt: organizations.createdAt,
            updatedAt: organizations.updatedAt,
          },
        })
        .from(projects)
        .leftJoin(users, eq(projects.createdBy, users.id))
        .leftJoin(organizations, eq(projects.organizationId, organizations.id))
        .where(whereClause)
        .orderBy(desc(projects.updatedAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(whereClause),
    ]);

    return {
      projects: projectsResult as ProjectWithDetails[],
      total: countResult[0]?.count || 0,
    };
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<boolean> {
    const [project] = await db.delete(projects).where(eq(projects.id, id)).returning();
    return !!project;
  }

  // Organization operations
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [newOrg] = await db.insert(organizations).values(org).returning();
    return newOrg;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations).orderBy(organizations.name);
  }

  // Permission operations
  async createFilePermission(permission: InsertFilePermission): Promise<FilePermission> {
    const [newPermission] = await db.insert(filePermissions).values(permission).returning();
    return newPermission;
  }

  async getFilePermissions(fileId: string): Promise<FilePermission[]> {
    return await db
      .select()
      .from(filePermissions)
      .where(eq(filePermissions.fileId, fileId));
  }

  async getUserFilePermission(fileId: string, userId: string): Promise<FilePermission | undefined> {
    const [permission] = await db
      .select()
      .from(filePermissions)
      .where(and(eq(filePermissions.fileId, fileId), eq(filePermissions.userId, userId)));
    return permission;
  }

  async deleteFilePermission(id: string): Promise<boolean> {
    const [permission] = await db.delete(filePermissions).where(eq(filePermissions.id, id)).returning();
    return !!permission;
  }

  // Audit operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(options: {
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: AuditLog[]; total: number }> {
    const { userId, resourceType, resourceId, limit = 50, offset = 0 } = options;

    let whereClause = sql`1=1`;
    
    if (userId) {
      whereClause = and(whereClause, eq(auditLogs.userId, userId));
    }
    
    if (resourceType) {
      whereClause = and(whereClause, eq(auditLogs.resourceType, resourceType));
    }
    
    if (resourceId) {
      whereClause = and(whereClause, eq(auditLogs.resourceId, resourceId));
    }

    const [logsResult, countResult] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(whereClause),
    ]);

    return {
      logs: logsResult,
      total: countResult[0]?.count || 0,
    };
  }

  // Share link operations
  async createShareLink(shareLink: InsertShareLink): Promise<ShareLink> {
    const [newLink] = await db.insert(shareLinks).values(shareLink).returning();
    return newLink;
  }

  async getShareLink(token: string): Promise<ShareLink | undefined> {
    const [link] = await db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.token, token), eq(shareLinks.isActive, true)));
    return link;
  }

  async getShareLinksByFile(fileId: string): Promise<ShareLink[]> {
    return await db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.fileId, fileId), eq(shareLinks.isActive, true)))
      .orderBy(desc(shareLinks.createdAt));
  }

  async updateShareLink(id: string, updates: Partial<InsertShareLink>): Promise<ShareLink | undefined> {
    const [link] = await db
      .update(shareLinks)
      .set(updates)
      .where(eq(shareLinks.id, id))
      .returning();
    return link;
  }

  async deleteShareLink(id: string): Promise<boolean> {
    const [link] = await db
      .update(shareLinks)
      .set({ isActive: false })
      .where(eq(shareLinks.id, id))
      .returning();
    return !!link;
  }
}

export const storage = new DatabaseStorage();
