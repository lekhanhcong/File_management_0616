import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { desc, eq, and, like, or, sql } from "drizzle-orm";
import * as schema from "../shared/schema.sqlite.js";

type File = typeof schema.files.$inferSelect;
type InsertFile = typeof schema.files.$inferInsert;
type User = typeof schema.users.$inferSelect;
type Project = typeof schema.projects.$inferSelect;

export class DatabaseStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const dbPath = process.env.NODE_ENV === "production" ? "prod.db" : "dev.db";
    const sqlite = new Database(dbPath);
    this.db = drizzle(sqlite, { schema });
  }

  async createFile(file: InsertFile): Promise<File> {
    const [insertedFile] = await this.db.insert(schema.files).values(file).returning();
    return insertedFile;
  }

  async getFile(id: string): Promise<File | null> {
    const file = await this.db.select().from(schema.files).where(eq(schema.files.id, id)).limit(1);
    return file[0] || null;
  }

  async listFiles(params: {
    limit?: number;
    offset?: number;
    search?: string;
    userId?: string;
    projectId?: string;
    mimeType?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ files: File[]; total: number }> {
    const {
      limit = 20,
      offset = 0,
      search,
      userId,
      projectId,
      mimeType,
      sortOrder = 'desc'
    } = params;

    // Build conditions (SQLite uses integers for booleans)
    const conditions: any[] = [eq(schema.files.isActive, 1)];
    
    if (userId) conditions.push(eq(schema.files.uploadedBy, userId));
    if (projectId) conditions.push(eq(schema.files.projectId, projectId));
    if (mimeType) conditions.push(eq(schema.files.mimeType, mimeType));
    
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${schema.files.name})`, searchTerm),
          like(sql`LOWER(${schema.files.originalName})`, searchTerm)
        )
      );
    }

    // Simplified query building
    const whereClause = conditions.length === 1 ? conditions[0] : 
                       conditions.length > 1 ? and(...conditions) : undefined;
    
    // Build files query
    const baseFilesQuery = this.db.select().from(schema.files);
    const filesQuery = whereClause ? baseFilesQuery.where(whereClause) : baseFilesQuery;
    
    const files = await filesQuery
      .orderBy(sortOrder === 'desc' ? desc(schema.files.createdAt) : schema.files.createdAt)
      .limit(limit)
      .offset(offset);

    // Get total count with a separate simpler query
    const baseCountQuery = this.db.select({ count: sql<number>`COUNT(*)`.as('count') }).from(schema.files);
    const countQuery = whereClause ? baseCountQuery.where(whereClause) : baseCountQuery;
    const countResult = await countQuery;
    const total = countResult[0]?.count || 0;

    return { files, total };
  }

  async updateFile(id: string, updates: Partial<File>): Promise<File | null> {
    const [updatedFile] = await this.db
      .update(schema.files)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.files.id, id))
      .returning();
    
    return updatedFile || null;
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await this.db
      .update(schema.files)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(schema.files.id, id));
    
    return result.changes > 0;
  }

  // User methods
  async createUser(user: { id: string; email: string; firstName?: string; lastName?: string }): Promise<User> {
    const [insertedUser] = await this.db.insert(schema.users).values(user).returning();
    return insertedUser;
  }

  async getUser(id: string): Promise<User | null> {
    const user = await this.db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return user[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
    return user[0] || null;
  }

  // Project methods
  async createProject(project: { id: string; name: string; description?: string; createdBy: string }): Promise<Project> {
    const [insertedProject] = await this.db.insert(schema.projects).values(project).returning();
    return insertedProject;
  }

  async getProject(id: string): Promise<Project | null> {
    const project = await this.db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
    return project[0] || null;
  }

  async listProjects(createdBy: string): Promise<Project[]> {
    return await this.db.select().from(schema.projects).where(eq(schema.projects.createdBy, createdBy));
  }

  // Alias for compatibility
  async getProjects(createdBy: string): Promise<Project[]> {
    return this.listProjects(createdBy);
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await this.db.delete(schema.projects).where(eq(schema.projects.id, id));
    return result.changes > 0;
  }

  // Alias for compatibility with routes
  async getFiles(params: any) {
    return this.listFiles(params);
  }

  // Placeholder methods for missing functionality
  async upsertUser(userData: any): Promise<User> {
    const existingUser = await this.getUserByEmail(userData.email);
    if (existingUser) {
      return existingUser;
    }
    return this.createUser(userData);
  }

  async createAuditLog(logData: any): Promise<any> {
    // Placeholder - audit logs not implemented in this schema
    console.log('Audit log:', logData);
    return { id: Date.now().toString() };
  }

  async getAuditLogs(params: any): Promise<any[]> {
    // Placeholder - audit logs not implemented in this schema
    return [];
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.db.select().from(schema.files).limit(1);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const storage = new DatabaseStorage();