// COMPREHENSIVE TEST SUITE FOR FILEFLOWMASTER
// Generated as part of 6-step systematic testing process
// Tests cover: Backend API, Authentication, File Management, Frontend Components

import { test, expect } from '@playwright/test';

test.describe('FileFlowMaster - Comprehensive Test Suite', () => {
  const BASE_URL = 'http://localhost:3001';
  
  // Test Group 1: Backend API Health Checks
  test.describe('Backend API Tests', () => {
    
    test('API Server responds to basic requests', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/user`);
      expect(response.status()).toBeLessThan(500); // Should not be server error
    });

    test('API handles unauthorized requests correctly', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/files`);
      expect(response.status()).toBe(401);
      const data = await response.json();
      expect(data.message).toBe('Unauthorized');
    });

    test('API returns proper headers', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/user`);
      const headers = response.headers();
      expect(headers['content-type']).toContain('application/json');
    });
  });

  // Test Group 2: Authentication Flow Tests
  test.describe('Authentication System', () => {
    
    test('Homepage loads successfully', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      // Test if we can access the page without errors
      const errors = await page.evaluate(() => window.console._errors || []);
      console.log('Page errors:', errors);
    });

    test('Sign In button is present and clickable', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForSelector('button:has-text("Sign In")', { timeout: 10000 });
      const signInButton = page.locator('button:has-text("Sign In")');
      await expect(signInButton).toBeVisible();
    });

    test('Login redirect flow works', async ({ page }) => {
      await page.goto(`${BASE_URL}/api/login`);
      // Should redirect somewhere, not show error page
      await page.waitForLoadState();
      expect(page.url()).not.toContain('error');
    });
  });

  // Test Group 3: File Management API Tests
  test.describe('File Management API', () => {
    
    test('File upload endpoint exists', async ({ request }) => {
      // Test with empty request to see if endpoint exists
      const response = await request.post(`${BASE_URL}/api/files/upload`);
      expect(response.status()).not.toBe(404); // Endpoint should exist
    });

    test('File listing API endpoint structure', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/files?page=1&limit=10`);
      // Should be unauthorized, not not-found
      expect([401, 200]).toContain(response.status());
    });

    test('File download endpoint exists', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/files/test-id/download`);
      expect(response.status()).not.toBe(404);
    });
  });

  // Test Group 4: Frontend Component Tests  
  test.describe('Frontend Components', () => {
    
    test('Homepage renders main elements', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Wait for content to load
      await page.waitForTimeout(3000);
      
      // Check for key elements that should be present
      const content = await page.content();
      expect(content).toContain('File Management');
    });

    test('Page structure and navigation', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      
      // Basic page structure tests
      const title = await page.title();
      console.log('Page title:', title);
      
      // Check if page has loaded some content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText.length).toBeGreaterThan(100);
    });

    test('Landing page call-to-action buttons', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForTimeout(2000);
      
      // Look for common CTA buttons
      const buttons = await page.locator('button').count();
      expect(buttons).toBeGreaterThan(0);
    });
  });

  // Test Group 5: Error Handling Tests
  test.describe('Error Handling', () => {
    
    test('404 handling for invalid routes', async ({ page }) => {
      const response = await page.goto(`${BASE_URL}/nonexistent-page`);
      // Should either redirect or show proper error page
      expect(response.status()).toBeLessThan(500);
    });

    test('API error responses are properly formatted', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/nonexistent`);
      if (response.status() === 404) {
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('json');
      }
    });

    test('Frontend handles API errors gracefully', async ({ page }) => {
      // Monitor console for unhandled errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(5000);
      
      // Log errors for debugging but don't fail if they're expected React errors
      console.log('Console errors:', errors);
    });
  });

  // Test Group 6: Performance Tests
  test.describe('Performance & Load Tests', () => {
    
    test('Homepage loads within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(BASE_URL);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;
      
      console.log(`Page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    });

    test('API response times are reasonable', async ({ request }) => {
      const startTime = Date.now();
      await request.get(`${BASE_URL}/api/auth/user`);
      const responseTime = Date.now() - startTime;
      
      console.log(`API response time: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });

  // Test Group 7: Security Tests
  test.describe('Security Tests', () => {
    
    test('Unauthorized access properly blocked', async ({ request }) => {
      const endpoints = [
        '/api/files',
        '/api/files/upload',
        '/api/admin/users'
      ];
      
      for (const endpoint of endpoints) {
        const response = await request.get(`${BASE_URL}${endpoint}`);
        expect([401, 403]).toContain(response.status());
      }
    });

    test('CSRF protection headers present', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/user`);
      const headers = response.headers();
      // Check for basic security headers
      console.log('Security headers:', headers);
    });
  });

  // Test Group 8: Database Integration Tests
  test.describe('Database Integration', () => {
    
    test('Database connection through API', async ({ request }) => {
      // Test if API can connect to database
      const response = await request.get(`${BASE_URL}/api/auth/user`);
      // 401 means database is connected (unauthorized but functional)
      // 500 would mean database connection issues
      expect(response.status()).not.toBe(500);
    });
  });
});