// END-TO-END FILE UPLOAD TESTING
// Tests the complete file upload workflow

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('File Upload End-to-End Tests', () => {
  const BASE_URL = 'http://localhost:3001';

  test.beforeEach(async ({ page }) => {
    // Create a test file for upload
    const testDir = path.join(process.cwd(), 'tests', 'temp');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const testFilePath = path.join(testDir, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'This is a test file for upload testing.');
  });

  test('File upload API endpoint accepts POST requests', async ({ request }) => {
    const testFilePath = path.join(process.cwd(), 'tests', 'temp', 'test-upload.txt');
    
    // Create form data
    const fileBuffer = fs.readFileSync(testFilePath);
    
    const response = await request.post(`${BASE_URL}/api/files/upload`, {
      multipart: {
        file: {
          name: 'test-upload.txt',
          mimeType: 'text/plain',
          buffer: fileBuffer
        },
        projectId: 'default'
      }
    });
    
    console.log('Upload response status:', response.status());
    console.log('Upload response:', await response.text());
    
    // Should be unauthorized (401) not not-found (404)
    expect([401, 200, 422]).toContain(response.status());
  });

  test('Files API returns proper JSON structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/files?limit=1`);
    
    if (response.status() === 401) {
      const data = await response.json();
      expect(data).toHaveProperty('message');
      expect(data.message).toBe('Unauthorized');
    } else if (response.status() === 200) {
      const data = await response.json();
      // Should have files array and pagination info
      expect(data).toHaveProperty('files');
      expect(Array.isArray(data.files)).toBe(true);
    }
  });

  test('Recent files API endpoint structure', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/files/recent`);
    
    console.log('Recent files status:', response.status());
    
    if (response.status() === 401) {
      const data = await response.json();
      expect(data.message).toBe('Unauthorized');
    } else if (response.status() === 200) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('File download endpoint accepts valid file IDs', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/files/test-file-id/download`);
    
    // Should return 401 (unauthorized) or 404 (file not found), not 500 (server error)
    expect(response.status()).toBeLessThan(500);
    expect([401, 404]).toContain(response.status());
  });

  test('File deletion endpoint exists and requires authorization', async ({ request }) => {
    const response = await request.delete(`${BASE_URL}/api/files/test-file-id`);
    
    // Should require authorization
    expect([401, 403, 404]).toContain(response.status());
  });
});