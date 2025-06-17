// REGRESSION TEST SUITE
// Ensures that all functionality continues to work after enhancements

import { test, expect } from '@playwright/test';

test.describe('Regression Test Suite - Post Enhancement', () => {
  const BASE_URL = 'http://localhost:3001';

  test.describe('New API Endpoints', () => {
    
    test('Health endpoint provides comprehensive status', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/health`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status', 'healthy');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('environment', 'development');
      expect(data).toHaveProperty('version', '1.0.0');
    });

    test('Info endpoint provides API documentation', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/info`);
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('name', 'FileFlowMaster API');
      expect(data).toHaveProperty('version', '1.0.0');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('endpoints');
      expect(data).toHaveProperty('features');
      expect(Array.isArray(data.features)).toBe(true);
    });

    test('Enhanced 404 handling for API routes', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/nonexistent-endpoint`);
      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('API endpoint');
      expect(data.error).toContain('not found');
    });
  });

  test.describe('Original Functionality Preserved', () => {
    
    test('Authentication endpoints still work', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/user`);
      expect([200, 401]).toContain(response.status());
      
      const data = await response.json();
      if (response.status() === 401) {
        expect(data).toHaveProperty('message', 'Unauthorized');
      }
    });

    test('File API endpoints maintain expected behavior', async ({ request }) => {
      const endpoints = [
        '/api/files',
        '/api/files/recent'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        expect([200, 401]).toContain(response.status());
        
        const data = await response.json();
        if (response.status() === 401) {
          expect(data.message).toBe('Unauthorized');
        }
      }
    });

    test('File upload endpoint maintains security', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/files/upload`, {
        multipart: {
          file: {
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('test content')
          }
        }
      });
      
      expect([401, 422, 400]).toContain(response.status());
      
      if (response.status() === 401) {
        const data = await response.json();
        expect(data.message).toBe('Unauthorized');
      }
    });
  });

  test.describe('Error Handling Improvements', () => {
    
    test('API errors return structured responses', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/invalid-endpoint`);
      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data).toHaveProperty('success', false);
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    });

    test('Server errors include development information', async ({ request }) => {
      // Test endpoints that might return server errors
      const response = await request.get(`${BASE_URL}/api/status`);
      
      if (response.status() >= 500) {
        const data = await response.json();
        expect(data).toHaveProperty('success', false);
        expect(data).toHaveProperty('error');
        // In development mode, should include stack trace
        expect(data).toHaveProperty('stack');
      }
    });
  });

  test.describe('Performance and Reliability', () => {
    
    test('Health endpoint responds quickly', async ({ request }) => {
      const startTime = Date.now();
      const response = await request.get(`${BASE_URL}/api/health`);
      const responseTime = Date.now() - startTime;
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('Multiple concurrent requests handled correctly', async ({ request }) => {
      const requests = Array(5).fill(null).map(() => 
        request.get(`${BASE_URL}/api/health`)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });
    });

    test('API endpoints maintain consistent response format', async ({ request }) => {
      const endpoints = [
        '/api/health',
        '/api/info',
        '/api/auth/user'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/json');
      }
    });
  });

  test.describe('Security Regression Tests', () => {
    
    test('Unauthorized access properly rejected across all endpoints', async ({ request }) => {
      const protectedEndpoints = [
        '/api/files',
        '/api/files/upload',
        '/api/files/recent'
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        expect([401, 403]).toContain(response.status());
      }
    });

    test('SQL injection protection maintained', async ({ request }) => {
      const maliciousInputs = [
        "'; DROP TABLE files; --",
        "1' OR '1'='1",
        "<script>alert('xss')</script>"
      ];
      
      for (const input of maliciousInputs) {
        const response = await request.get(`${BASE_URL}/api/files?search=${encodeURIComponent(input)}`);
        expect(response.status()).not.toBe(500); // Should not cause server error
      }
    });
  });
});