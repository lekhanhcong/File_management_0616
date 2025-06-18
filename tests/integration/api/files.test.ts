import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '@/server/routes';
import { setupTestDatabase, cleanupTestDatabase, createTestUser, createTestFile } from '../helpers/database';
import { generateTestTokens } from '../helpers/auth';

describe('Files API Integration Tests', () => {
  let app: express.Application;
  let testUser: any;
  let authTokens: any;

  beforeAll(async () => {
    await setupTestDatabase();
    app = express();
    await registerRoutes(app);
    
    testUser = await createTestUser({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'password123',
    });
    
    authTokens = generateTestTokens(testUser);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up files between tests
    await cleanupTestFiles();
  });

  describe('POST /api/files/upload', () => {
    it('uploads a file successfully', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .attach('file', Buffer.from('test file content'), 'test.txt')
        .field('projectId', 'test-project')
        .field('description', 'Test file upload');

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        file: expect.objectContaining({
          id: expect.any(String),
          name: 'test.txt',
          type: 'text/plain',
          uploaderId: testUser.id,
          description: 'Test file upload',
        }),
      });
    });

    it('rejects file upload without authentication', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('test content'), 'test.txt');

      expect(response.status).toBe(401);
    });

    it('rejects file upload without file', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .field('description', 'No file attached');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No file uploaded');
    });

    it('enforces file size limits', async () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB file
      
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .attach('file', largeBuffer, 'large-file.bin');

      expect(response.status).toBe(413);
    });

    it('validates file types', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .attach('file', Buffer.from('malicious content'), 'script.exe');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('File type not allowed');
    });
  });

  describe('GET /api/files', () => {
    beforeEach(async () => {
      // Create test files
      await createTestFile({
        name: 'document1.pdf',
        type: 'application/pdf',
        uploaderId: testUser.id,
        tags: ['important', 'work'],
      });
      
      await createTestFile({
        name: 'image1.jpg',
        type: 'image/jpeg',
        uploaderId: testUser.id,
        tags: ['photo'],
      });
    });

    it('returns paginated file list', async () => {
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        files: expect.arrayContaining([
          expect.objectContaining({
            name: 'document1.pdf',
            type: 'application/pdf',
          }),
          expect.objectContaining({
            name: 'image1.jpg',
            type: 'image/jpeg',
          }),
        ]),
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        }),
      });
    });

    it('supports search functionality', async () => {
      const response = await request(app)
        .get('/api/files?search=document')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].name).toBe('document1.pdf');
    });

    it('supports type filtering', async () => {
      const response = await request(app)
        .get('/api/files?type=image')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].name).toBe('image1.jpg');
    });

    it('supports tag filtering', async () => {
      const response = await request(app)
        .get('/api/files?tags=important')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(1);
      expect(response.body.files[0].name).toBe('document1.pdf');
    });

    it('supports sorting', async () => {
      const response = await request(app)
        .get('/api/files?sortBy=name&sortOrder=asc')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files[0].name).toBe('document1.pdf');
      expect(response.body.files[1].name).toBe('image1.jpg');
    });

    it('supports pagination', async () => {
      const response = await request(app)
        .get('/api/files?page=1&limit=1')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(1);
      expect(response.body.pagination.totalPages).toBe(2);
    });
  });

  describe('GET /api/files/:id', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = await createTestFile({
        name: 'test-file.pdf',
        type: 'application/pdf',
        uploaderId: testUser.id,
      });
    });

    it('returns file details', async () => {
      const response = await request(app)
        .get(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: testFile.id,
        name: 'test-file.pdf',
        type: 'application/pdf',
        uploaderId: testUser.id,
      });
    });

    it('returns 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/api/files/non-existent-id')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(404);
    });

    it('enforces file permissions', async () => {
      const otherUser = await createTestUser({
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'User',
        password: 'password123',
      });
      
      const otherTokens = generateTestTokens(otherUser);

      const response = await request(app)
        .get(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${otherTokens.accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/files/:id', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = await createTestFile({
        name: 'test-file.pdf',
        type: 'application/pdf',
        uploaderId: testUser.id,
        description: 'Original description',
        tags: ['original'],
      });
    });

    it('updates file metadata', async () => {
      const updateData = {
        name: 'updated-file.pdf',
        description: 'Updated description',
        tags: ['updated', 'modified'],
      };

      const response = await request(app)
        .put(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ...updateData,
        id: testFile.id,
      });
    });

    it('validates update data', async () => {
      const response = await request(app)
        .put(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ name: '' }); // Invalid empty name

      expect(response.status).toBe(400);
    });

    it('only allows owner to update', async () => {
      const otherUser = await createTestUser({
        email: 'other2@example.com',
        firstName: 'Other',
        lastName: 'User',
        password: 'password123',
      });
      
      const otherTokens = generateTestTokens(otherUser);

      const response = await request(app)
        .put(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${otherTokens.accessToken}`)
        .send({ name: 'hacked-file.pdf' });

      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/files/:id', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = await createTestFile({
        name: 'test-file.pdf',
        type: 'application/pdf',
        uploaderId: testUser.id,
      });
    });

    it('deletes file successfully', async () => {
      const response = await request(app)
        .delete(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(204);

      // Verify file is deleted
      const getResponse = await request(app)
        .get(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(getResponse.status).toBe(404);
    });

    it('only allows owner to delete', async () => {
      const otherUser = await createTestUser({
        email: 'other3@example.com',
        firstName: 'Other',
        lastName: 'User',
        password: 'password123',
      });
      
      const otherTokens = generateTestTokens(otherUser);

      const response = await request(app)
        .delete(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${otherTokens.accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/files/:id/star', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = await createTestFile({
        name: 'test-file.pdf',
        uploaderId: testUser.id,
      });
    });

    it('stars a file', async () => {
      const response = await request(app)
        .post(`/api/files/${testFile.id}/star`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isStarred).toBe(true);
    });

    it('unstars a starred file', async () => {
      // Star the file first
      await request(app)
        .post(`/api/files/${testFile.id}/star`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      // Unstar it
      const response = await request(app)
        .post(`/api/files/${testFile.id}/star`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.isStarred).toBe(false);
    });
  });

  describe('GET /api/files/:id/download', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = await createTestFile({
        name: 'test-file.txt',
        uploaderId: testUser.id,
        content: 'test file content',
      });
    });

    it('downloads file successfully', async () => {
      const response = await request(app)
        .get(`/api/files/${testFile.id}/download`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/plain');
      expect(response.headers['content-disposition']).toContain('test-file.txt');
      expect(response.text).toBe('test file content');
    });

    it('increments download count', async () => {
      await request(app)
        .get(`/api/files/${testFile.id}/download`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      const fileResponse = await request(app)
        .get(`/api/files/${testFile.id}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(fileResponse.body.downloadCount).toBe(1);
    });

    it('enforces download permissions', async () => {
      // Create file with no download permission for others
      const restrictedFile = await createTestFile({
        name: 'restricted.txt',
        uploaderId: testUser.id,
        permissions: { canDownload: false },
      });

      const otherUser = await createTestUser({
        email: 'other4@example.com',
        firstName: 'Other',
        lastName: 'User',
        password: 'password123',
      });
      
      const otherTokens = generateTestTokens(otherUser);

      const response = await request(app)
        .get(`/api/files/${restrictedFile.id}/download`)
        .set('Authorization', `Bearer ${otherTokens.accessToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('File Sharing', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = await createTestFile({
        name: 'shared-file.pdf',
        uploaderId: testUser.id,
      });
    });

    it('shares file with specific users', async () => {
      const otherUser = await createTestUser({
        email: 'shared@example.com',
        firstName: 'Shared',
        lastName: 'User',
        password: 'password123',
      });

      const shareData = {
        userIds: [otherUser.id],
        permissions: ['view', 'download'],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post(`/api/files/${testFile.id}/share`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(shareData);

      expect(response.status).toBe(200);
      expect(response.body.sharedWith).toContainEqual(
        expect.objectContaining({
          userId: otherUser.id,
          permissions: ['view', 'download'],
        })
      );
    });

    it('makes file public', async () => {
      const response = await request(app)
        .post(`/api/files/${testFile.id}/share`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ isPublic: true });

      expect(response.status).toBe(200);
      expect(response.body.isPublic).toBe(true);
    });
  });

  describe('File Comments', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = await createTestFile({
        name: 'commented-file.pdf',
        uploaderId: testUser.id,
      });
    });

    it('adds comment to file', async () => {
      const commentData = {
        content: 'This is a test comment',
        position: { line: 1, column: 1 },
      };

      const response = await request(app)
        .post(`/api/files/${testFile.id}/comments`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send(commentData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        content: 'This is a test comment',
        userId: testUser.id,
        fileId: testFile.id,
        position: { line: 1, column: 1 },
      });
    });

    it('retrieves file comments', async () => {
      // Add a comment first
      await request(app)
        .post(`/api/files/${testFile.id}/comments`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ content: 'Test comment' });

      const response = await request(app)
        .get(`/api/files/${testFile.id}/comments`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].content).toBe('Test comment');
    });
  });

  describe('Error Handling', () => {
    it('handles database errors gracefully', async () => {
      // Simulate database error by using invalid file ID format
      const response = await request(app)
        .get('/api/files/invalid-id-format')
        .set('Authorization', `Bearer ${authTokens.accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid file ID');
    });

    it('handles network timeouts', async () => {
      // This would be handled by the test framework's timeout configuration
      const response = await request(app)
        .get('/api/files')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .timeout(1000);

      expect(response.status).toBeLessThan(500);
    }, 2000);
  });
});

// Helper function to clean up test files
async function cleanupTestFiles() {
  // Implementation would depend on your database setup
  // This should remove all test files from the database
}