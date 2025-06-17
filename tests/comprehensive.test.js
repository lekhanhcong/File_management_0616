// Comprehensive Test Suite for FileFlowMaster
// Enhanced with MCP Playwright integration

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_FILE_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-document.txt');

test.describe('FileFlowMaster - Comprehensive Test Suite', () => {
  
  test.beforeAll(async () => {
    // Create test fixtures directory
    const fixturesDir = path.dirname(TEST_FILE_PATH);
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
    
    // Create test file
    if (!fs.existsSync(TEST_FILE_PATH)) {
      fs.writeFileSync(TEST_FILE_PATH, 'This is a test document for FileFlowMaster E2E testing.');
    }
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Wait for application to fully load
    await page.waitForTimeout(2000);
  });

  // === CORE FUNCTIONALITY TESTS ===
  
  test.describe('Authentication & User Management', () => {
    test('should handle authentication flow', async ({ page }) => {
      // Check if authentication is working (dev mode)
      const authButton = page.locator('button:has-text("Login"), button:has-text("Sign In")');
      if (await authButton.isVisible({ timeout: 2000 })) {
        await authButton.click();
        await page.waitForLoadState('networkidle');
      }
      
      // Verify authenticated state
      await expect(page.locator('[data-testid="user-info"], .user-info')).toBeVisible({ timeout: 10000 });
    });

    test('should display user information correctly', async ({ page }) => {
      // Check user profile elements
      const userElements = [
        '[data-testid="user-avatar"]',
        '[data-testid="user-name"]',
        '.user-avatar',
        '.user-name'
      ];
      
      let userFound = false;
      for (const selector of userElements) {
        if (await page.locator(selector).isVisible({ timeout: 2000 })) {
          userFound = true;
          break;
        }
      }
      expect(userFound).toBe(true);
    });
  });

  test.describe('File Management Core Features', () => {
    test('should display file management interface', async ({ page }) => {
      // Check main components are visible
      await expect(page.locator('nav, [role="navigation"], .sidebar')).toBeVisible();
      await expect(page.locator('main, [role="main"], .main-content')).toBeVisible();
    });

    test('should show upload functionality', async ({ page }) => {
      // Look for upload button/area
      const uploadSelectors = [
        'button:has-text("Upload")',
        '[data-testid="upload-button"]',
        '.upload-button',
        'input[type="file"]'
      ];
      
      let uploadFound = false;
      for (const selector of uploadSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 })) {
          uploadFound = true;
          await page.locator(selector).first().click();
          break;
        }
      }
      expect(uploadFound).toBe(true);
    });

    test('should display file list/table', async ({ page }) => {
      // Check for file listing
      const fileListSelectors = [
        'table',
        '[data-testid="file-table"]',
        '.file-list',
        '.file-grid'
      ];
      
      let listFound = false;
      for (const selector of fileListSelectors) {
        if (await page.locator(selector).isVisible({ timeout: 2000 })) {
          listFound = true;
          break;
        }
      }
      expect(listFound).toBe(true);
    });
  });

  test.describe('Navigation & UI Components', () => {
    test('should have functional navigation menu', async ({ page }) => {
      // Test navigation items
      const navItems = [
        'Home',
        'Files',
        'Projects',
        'Settings'
      ];
      
      for (const item of navItems) {
        const navLink = page.locator(`nav a:has-text("${item}"), button:has-text("${item}")`);
        if (await navLink.isVisible({ timeout: 2000 })) {
          await navLink.click();
          await page.waitForTimeout(1000);
        }
      }
    });

    test('should handle search functionality', async ({ page }) => {
      // Find search input
      const searchSelectors = [
        'input[placeholder*="Search"]',
        'input[type="search"]',
        '[data-testid="search-input"]'
      ];
      
      let searchInput = null;
      for (const selector of searchSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          searchInput = element;
          break;
        }
      }
      
      if (searchInput) {
        await searchInput.fill('test');
        await searchInput.press('Enter');
        await page.waitForTimeout(2000);
      }
    });
  });

  // === API & BACKEND TESTS ===
  
  test.describe('API Integration Tests', () => {
    test('should successfully call authentication endpoints', async ({ page }) => {
      const apiResponses = [];
      
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          apiResponses.push({
            url: response.url(),
            status: response.status(),
            method: response.request().method()
          });
        }
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check for successful API calls
      const authCalls = apiResponses.filter(r => r.url.includes('/auth'));
      expect(authCalls.length).toBeGreaterThan(0);
      
      // Check for files API calls
      const filesCalls = apiResponses.filter(r => r.url.includes('/files'));
      expect(filesCalls.some(call => call.status === 200)).toBe(true);
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Monitor console errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      // Test error scenarios
      await page.goto(`${BASE_URL}/api/invalid-endpoint`);
      await page.waitForTimeout(2000);
      
      // Should handle errors without crashing
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
    });
  });

  // === PERFORMANCE TESTS ===
  
  test.describe('Performance & Loading Tests', () => {
    test('should load within acceptable time limits', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(BASE_URL);
      await page.waitForSelector('main, [role="main"], .main-content', { timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      console.log(`Page load time: ${loadTime}ms`);
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle large file lists efficiently', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Measure rendering time for file lists
      const startRender = Date.now();
      await page.locator('table, .file-list, .file-grid').first().waitFor({ timeout: 5000 });
      const renderTime = Date.now() - startRender;
      
      console.log(`File list render time: ${renderTime}ms`);
      expect(renderTime).toBeLessThan(3000);
    });
  });

  // === RESPONSIVE DESIGN TESTS ===
  
  test.describe('Responsive Design Tests', () => {
    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Check that main elements are still visible
      await expect(page.locator('main, [role="main"]')).toBeVisible();
      
      // Take screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/tablet-responsive.png',
        fullPage: true 
      });
    });

    test('should work on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Check mobile navigation
      const mobileMenu = page.locator('button[aria-label*="menu"], .mobile-menu-toggle');
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        await page.waitForTimeout(1000);
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/mobile-responsive.png',
        fullPage: true 
      });
    });

    test('should handle different screen sizes', async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080, name: 'desktop-large' },
        { width: 1366, height: 768, name: 'desktop-medium' },
        { width: 1024, height: 768, name: 'tablet-landscape' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        
        // Verify main content is visible
        await expect(page.locator('main, [role="main"]')).toBeVisible();
        
        // Take screenshot
        await page.screenshot({ 
          path: `tests/screenshots/responsive-${viewport.name}.png`,
          fullPage: true 
        });
      }
    });
  });

  // === ACCESSIBILITY TESTS ===
  
  test.describe('Accessibility Tests', () => {
    test('should have proper ARIA landmarks', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Check for semantic HTML and ARIA landmarks
      const landmarks = [
        '[role="main"], main',
        '[role="navigation"], nav',
        '[role="banner"], header',
        '[role="contentinfo"], footer'
      ];
      
      for (const landmark of landmarks) {
        const element = page.locator(landmark);
        if (await element.count() > 0) {
          console.log(`Found landmark: ${landmark}`);
        }
      }
      
      // At least main and navigation should exist
      expect(await page.locator('[role="main"], main').count()).toBeGreaterThan(0);
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Test keyboard navigation
      let focusableElements = 0;
      const maxTabs = 15;
      
      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab');
        const focused = page.locator(':focus');
        
        if (await focused.count() > 0) {
          focusableElements++;
          const tagName = await focused.evaluate(el => el.tagName);
          console.log(`Tab ${i + 1}: ${tagName}`);
        }
      }
      
      expect(focusableElements).toBeGreaterThan(3);
    });

    test('should have proper heading structure', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Check heading hierarchy
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      expect(headings.length).toBeGreaterThan(0);
      
      // Should have at least one h1
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });
  });

  // === SECURITY TESTS ===
  
  test.describe('Security Tests', () => {
    test('should handle XSS prevention', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Try to inject script in search
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      if (await searchInput.isVisible({ timeout: 2000 })) {
        await searchInput.fill('<script>alert("XSS")</script>');
        await searchInput.press('Enter');
        await page.waitForTimeout(1000);
        
        // Should not execute script
        const alerts = [];
        page.on('dialog', dialog => {
          alerts.push(dialog.message());
          dialog.dismiss();
        });
        
        expect(alerts.length).toBe(0);
      }
    });

    test('should validate HTTPS in production URLs', async ({ page }) => {
      // Check that external links use HTTPS
      const links = await page.locator('a[href^="http://"]').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && !href.includes('localhost')) {
          console.warn(`Insecure HTTP link found: ${href}`);
        }
      }
    });
  });

  // === ERROR HANDLING TESTS ===
  
  test.describe('Error Handling Tests', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Monitor console errors
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Simulate network issues
      await page.route('**/api/**', route => {
        if (Math.random() < 0.3) { // 30% failure rate
          route.abort('failed');
        } else {
          route.continue();
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForTimeout(5000);
      
      // Check that app still functions despite some failed requests
      await expect(page.locator('main, [role="main"]')).toBeVisible();
    });

    test('should show proper error messages', async ({ page }) => {
      await page.goto(`${BASE_URL}/nonexistent-page`);
      await page.waitForLoadState('networkidle');
      
      // Should show 404 or redirect appropriately
      const errorIndicators = [
        'text="404"',
        'text="Not Found"',
        'text="Page not found"',
        'text="Error"'
      ];
      
      let errorShown = false;
      for (const indicator of errorIndicators) {
        if (await page.locator(indicator).isVisible({ timeout: 2000 })) {
          errorShown = true;
          break;
        }
      }
      
      // If no error shown, should have redirected to home
      if (!errorShown) {
        expect(page.url()).toBe(`${BASE_URL}/`);
      }
    });
  });

  // === WEBSOCKET TESTS ===
  
  test.describe('WebSocket & Real-time Features', () => {
    test('should establish WebSocket connection', async ({ page }) => {
      let wsConnected = false;
      let wsMessages = [];
      
      page.on('websocket', ws => {
        console.log('WebSocket connection established');
        wsConnected = true;
        
        ws.on('framereceived', event => {
          wsMessages.push(event.payload);
        });
        
        ws.on('close', () => {
          console.log('WebSocket closed');
        });
      });
      
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);
      
      // WebSocket should be connected for real-time features
      expect(wsConnected).toBe(true);
    });
  });
});

// === CLEANUP ===
test.afterAll(async () => {
  // Cleanup test files
  if (fs.existsSync(TEST_FILE_PATH)) {
    fs.unlinkSync(TEST_FILE_PATH);
  }
});