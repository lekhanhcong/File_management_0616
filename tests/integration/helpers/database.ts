import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/shared/schema';
import bcrypt from 'bcryptjs';

let testDb: any;
let sqlite: Database.Database;

export async function setupTestDatabase() {
  // Create in-memory database for testing
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });

  // Run migrations
  await migrate(testDb, { migrationsFolder: './migrations' });

  console.log('Test database setup complete');
}

export async function cleanupTestDatabase() {
  if (sqlite) {
    sqlite.close();
  }
  console.log('Test database cleanup complete');
}

export async function createTestUser(userData: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: string;
}) {
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const user = {
    id: userId,
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    passwordHash: hashedPassword,
    role: userData.role || 'user',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(schema.users).values(user);
  
  return user;
}

export async function createTestProject(projectData: {
  name: string;
  ownerId: string;
  description?: string;
  isPublic?: boolean;
}) {
  const projectId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const project = {
    id: projectId,
    name: projectData.name,
    description: projectData.description || null,
    ownerId: projectData.ownerId,
    isPublic: projectData.isPublic || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(schema.projects).values(project);
  
  return project;
}

export async function createTestFile(fileData: {
  name: string;
  uploaderId: string;
  type?: string;
  size?: number;
  projectId?: string;
  description?: string;
  tags?: string[];
  content?: string;
  permissions?: any;
}) {
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const file = {
    id: fileId,
    name: fileData.name,
    type: fileData.type || 'text/plain',
    size: fileData.size || 1024,
    uploaderId: fileData.uploaderId,
    projectId: fileData.projectId || null,
    description: fileData.description || null,
    tags: fileData.tags ? JSON.stringify(fileData.tags) : null,
    path: `/test/files/${fileId}`,
    isStarred: false,
    downloadCount: 0,
    viewCount: 0,
    uploadDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(schema.files).values(file);
  
  // If content is provided, simulate file storage
  if (fileData.content) {
    // In a real test, you might write to a test file system
    // For now, we'll just store it in memory
    file.content = fileData.content;
  }
  
  return file;
}

export async function createTestTeam(teamData: {
  name: string;
  ownerId: string;
  description?: string;
  slug?: string;
  isPublic?: boolean;
}) {
  const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const team = {
    id: teamId,
    name: teamData.name,
    description: teamData.description || null,
    slug: teamData.slug || teamData.name.toLowerCase().replace(/\s+/g, '-'),
    ownerId: teamData.ownerId,
    isPublic: teamData.isPublic || false,
    memberCount: 1,
    projectCount: 0,
    fileCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(schema.teams).values(team);
  
  // Add owner as team member
  await testDb.insert(schema.teamMembers).values({
    id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: teamData.ownerId,
    teamId: teamId,
    role: 'owner',
    joinedAt: new Date(),
    isActive: true,
  });
  
  return team;
}

export async function createTestComment(commentData: {
  content: string;
  userId: string;
  fileId: string;
  parentId?: string;
  position?: { line: number; column: number };
}) {
  const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const comment = {
    id: commentId,
    content: commentData.content,
    userId: commentData.userId,
    fileId: commentData.fileId,
    parentId: commentData.parentId || null,
    position: commentData.position ? JSON.stringify(commentData.position) : null,
    isPinned: false,
    isResolved: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await testDb.insert(schema.fileComments).values(comment);
  
  return comment;
}

export async function createTestActivity(activityData: {
  userId: string;
  type: string;
  description: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: any;
}) {
  const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const activity = {
    id: activityId,
    userId: activityData.userId,
    type: activityData.type,
    description: activityData.description,
    resourceType: activityData.resourceType || null,
    resourceId: activityData.resourceId || null,
    metadata: activityData.metadata ? JSON.stringify(activityData.metadata) : null,
    timestamp: new Date(),
  };

  await testDb.insert(schema.activities).values(activity);
  
  return activity;
}

export async function cleanupTestData() {
  // Clean up all test data in proper order to avoid foreign key constraints
  if (testDb) {
    await testDb.delete(schema.fileComments);
    await testDb.delete(schema.activities);
    await testDb.delete(schema.teamMembers);
    await testDb.delete(schema.teams);
    await testDb.delete(schema.files);
    await testDb.delete(schema.projects);
    await testDb.delete(schema.users);
  }
}

export async function seedTestData() {
  // Create a standard set of test data for consistent testing
  
  // Create test users
  const user1 = await createTestUser({
    email: 'user1@test.com',
    firstName: 'User',
    lastName: 'One',
    password: 'password123',
  });

  const user2 = await createTestUser({
    email: 'user2@test.com',
    firstName: 'User',
    lastName: 'Two',
    password: 'password123',
  });

  const admin = await createTestUser({
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    password: 'password123',
    role: 'admin',
  });

  // Create test project
  const project = await createTestProject({
    name: 'Test Project',
    ownerId: user1.id,
    description: 'A test project for integration tests',
    isPublic: false,
  });

  // Create test team
  const team = await createTestTeam({
    name: 'Test Team',
    ownerId: user1.id,
    description: 'A test team for collaboration',
    slug: 'test-team',
  });

  // Add user2 to the team
  await testDb.insert(schema.teamMembers).values({
    id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: user2.id,
    teamId: team.id,
    role: 'member',
    joinedAt: new Date(),
    isActive: true,
  });

  // Create test files
  const file1 = await createTestFile({
    name: 'test-document.pdf',
    type: 'application/pdf',
    size: 1024000,
    uploaderId: user1.id,
    projectId: project.id,
    description: 'Test PDF document',
    tags: ['important', 'document'],
  });

  const file2 = await createTestFile({
    name: 'test-image.jpg',
    type: 'image/jpeg',
    size: 2048000,
    uploaderId: user2.id,
    description: 'Test image file',
    tags: ['photo', 'test'],
  });

  // Create test comments
  await createTestComment({
    content: 'This is a test comment',
    userId: user2.id,
    fileId: file1.id,
    position: { line: 1, column: 1 },
  });

  // Create test activities
  await createTestActivity({
    userId: user1.id,
    type: 'file_uploaded',
    description: 'Uploaded test-document.pdf',
    resourceType: 'file',
    resourceId: file1.id,
  });

  return {
    users: { user1, user2, admin },
    project,
    team,
    files: { file1, file2 },
  };
}

// Database query helpers for tests
export async function getUserById(id: string) {
  const result = await testDb.select().from(schema.users).where(schema.users.id.eq(id)).limit(1);
  return result[0] || null;
}

export async function getFileById(id: string) {
  const result = await testDb.select().from(schema.files).where(schema.files.id.eq(id)).limit(1);
  return result[0] || null;
}

export async function getProjectById(id: string) {
  const result = await testDb.select().from(schema.projects).where(schema.projects.id.eq(id)).limit(1);
  return result[0] || null;
}

export async function getTeamById(id: string) {
  const result = await testDb.select().from(schema.teams).where(schema.teams.id.eq(id)).limit(1);
  return result[0] || null;
}

export async function getFilesByUserId(userId: string) {
  return await testDb.select().from(schema.files).where(schema.files.uploaderId.eq(userId));
}

export async function getTeamMembers(teamId: string) {
  return await testDb
    .select()
    .from(schema.teamMembers)
    .leftJoin(schema.users, schema.teamMembers.userId.eq(schema.users.id))
    .where(schema.teamMembers.teamId.eq(teamId));
}

export async function getFileComments(fileId: string) {
  return await testDb
    .select()
    .from(schema.fileComments)
    .leftJoin(schema.users, schema.fileComments.userId.eq(schema.users.id))
    .where(schema.fileComments.fileId.eq(fileId));
}

// Test database instance getter
export function getTestDb() {
  return testDb;
}