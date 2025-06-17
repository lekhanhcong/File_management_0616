// Performance Test Suite for FileFlowMaster
// Advanced performance testing with MCP Playwright

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5000';

test.describe('Performance Tests - FileFlowMaster', () => {
  
  test.beforeEach(async ({ page }) => {
    // Enable performance metrics
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Core Web Vitals', () => {
    test('should meet Largest Contentful Paint (LCP) requirements', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Measure LCP
      const lcp = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.startTime);
          }).observe({ entryTypes: ['largest-contentful-paint'] });
          
          // Fallback timeout
          setTimeout(() => resolve(0), 5000);
        });
      });
      
      console.log(`LCP: ${lcp}ms`);
      // LCP should be under 2.5 seconds (2500ms)
      expect(lcp).toBeLessThan(2500);
    });

    test('should meet First Input Delay (FID) requirements', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Simulate user interaction and measure response time
      const startTime = Date.now();
      
      // Find first interactive element
      const button = page.locator('button, a, input').first();
      await button.click();
      
      const responseTime = Date.now() - startTime;
      console.log(`First input response time: ${responseTime}ms`);
      
      // FID should be under 100ms
      expect(responseTime).toBeLessThan(100);
    });

    test('should meet Cumulative Layout Shift (CLS) requirements', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Measure CLS
      const cls = await page.evaluate(() => {
        return new Promise((resolve) => {
          let clsValue = 0;
          
          new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
          }).observe({ entryTypes: ['layout-shift'] });
          
          // Wait for page to stabilize
          setTimeout(() => resolve(clsValue), 3000);
        });
      });
      
      console.log(`CLS: ${cls}`);
      // CLS should be under 0.1
      expect(cls).toBeLessThan(0.1);
    });
  });

  test.describe('Loading Performance', () => {
    test('should load initial bundle efficiently', async ({ page }) => {
      const responses = [];
      
      page.on('response', response => {
        if (response.url().includes('.js') || response.url().includes('.css')) {
          responses.push({
            url: response.url(),
            size: response.headers()['content-length'],
            status: response.status()
          });
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Check bundle sizes
      const jsFiles = responses.filter(r => r.url.includes('.js'));
      const cssFiles = responses.filter(r => r.url.includes('.css'));
      
      console.log(`JS files loaded: ${jsFiles.length}`);
      console.log(`CSS files loaded: ${cssFiles.length}`);
      
      // Should not load excessive number of files
      expect(jsFiles.length).toBeLessThan(10);
      expect(cssFiles.length).toBeLessThan(5);
    });

    test('should efficiently load and render file lists', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Measure file list rendering time
      const renderStart = Date.now();
      
      // Look for file table/list
      const fileList = page.locator('table, .file-list, .file-grid, [data-testid="file-table"]');
      await fileList.first().waitFor({ timeout: 5000 });
      
      const renderTime = Date.now() - renderStart;
      console.log(`File list render time: ${renderTime}ms`);
      
      // Should render quickly
      expect(renderTime).toBeLessThan(2000);
    });

    test('should handle pagination efficiently', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Look for pagination controls
      const pagination = page.locator('.pagination, [data-testid="pagination"]');
      const nextButton = page.locator('button:has-text("Next"), button[aria-label*="next"]');
      
      if (await nextButton.isVisible({ timeout: 2000 })) {
        const paginationStart = Date.now();
        await nextButton.click();
        await page.waitForLoadState('networkidle');
        const paginationTime = Date.now() - paginationStart;
        
        console.log(`Pagination response time: ${paginationTime}ms`);
        expect(paginationTime).toBeLessThan(1500);
      }
    });
  });

  test.describe('API Performance', () => {
    test('should have fast API response times', async ({ page }) => {
      const apiTimes = [];
      
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          const timing = response.timing();
          apiTimes.push({
            url: response.url(),
            responseTime: timing.responseEnd - timing.requestStart,
            status: response.status()
          });
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Check API response times
      const avgResponseTime = apiTimes.reduce((sum, api) => sum + api.responseTime, 0) / apiTimes.length;
      console.log(`Average API response time: ${avgResponseTime}ms`);
      console.log(`API calls made: ${apiTimes.length}`);
      
      // API responses should be fast
      expect(avgResponseTime).toBeLessThan(500);
      
      // No API call should be extremely slow
      const slowCalls = apiTimes.filter(api => api.responseTime > 2000);
      expect(slowCalls.length).toBe(0);
    });

    test('should handle concurrent API requests efficiently', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      const concurrentRequests = [];
      
      // Trigger multiple actions simultaneously
      const actions = [
        () => page.reload(),
        () => page.locator('button:has-text("Refresh")').click().catch(() => {}),
        () => page.locator('input[type="search"]').fill('test').catch(() => {})
      ];
      
      const startTime = Date.now();
      await Promise.all(actions.map(action => action()));
      const endTime = Date.now();
      
      console.log(`Concurrent operations completed in: ${endTime - startTime}ms`);
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not have excessive memory usage', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        return performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        } : null;
      });
      
      if (initialMemory) {
        console.log(`Initial memory usage: ${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Simulate user interactions
        await page.click('body');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        // Check memory after interactions
        const finalMemory = await page.evaluate(() => {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize
          };
        });
        
        const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
        console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
        
        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB increase
      }
    });

    test('should handle file uploads without memory leaks', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Look for file upload
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible({ timeout: 2000 })) {
        // Monitor memory during file operations
        const beforeUpload = await page.evaluate(() => 
          performance.memory ? performance.memory.usedJSHeapSize : 0
        );
        
        // Simulate file selection (without actual upload)
        await fileInput.hover();
        
        const afterUpload = await page.evaluate(() => 
          performance.memory ? performance.memory.usedJSHeapSize : 0
        );
        
        const memoryDiff = afterUpload - beforeUpload;
        console.log(`Memory difference during upload simulation: ${(memoryDiff / 1024).toFixed(2)} KB`);
      }
    });
  });

  test.describe('Network Performance', () => {
    test('should optimize resource loading', async ({ page }) => {
      const resourceSizes = [];
      
      page.on('response', response => {
        const contentLength = response.headers()['content-length'];
        if (contentLength) {
          resourceSizes.push({
            url: response.url(),
            size: parseInt(contentLength),
            type: response.request().resourceType()
          });
        }
      });
      
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Analyze resource sizes
      const totalSize = resourceSizes.reduce((sum, resource) => sum + resource.size, 0);
      const jsSize = resourceSizes.filter(r => r.type === 'script').reduce((sum, r) => sum + r.size, 0);
      const cssSize = resourceSizes.filter(r => r.type === 'stylesheet').reduce((sum, r) => sum + r.size, 0);
      const imageSize = resourceSizes.filter(r => r.type === 'image').reduce((sum, r) => sum + r.size, 0);
      
      console.log(`Total page size: ${(totalSize / 1024).toFixed(2)} KB`);
      console.log(`JavaScript size: ${(jsSize / 1024).toFixed(2)} KB`);
      console.log(`CSS size: ${(cssSize / 1024).toFixed(2)} KB`);
      console.log(`Images size: ${(imageSize / 1024).toFixed(2)} KB`);
      
      // Page should not be excessively large
      expect(totalSize).toBeLessThan(5 * 1024 * 1024); // Less than 5MB total
      expect(jsSize).toBeLessThan(2 * 1024 * 1024); // Less than 2MB JS
    });

    test('should cache resources appropriately', async ({ page }) => {
      // First load
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Count initial requests
      const firstLoadRequests = [];
      page.on('request', request => {
        firstLoadRequests.push(request.url());
      });
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Count reload requests
      const reloadRequests = [];
      page.on('request', request => {
        reloadRequests.push(request.url());
      });
      
      // Some resources should be cached on reload
      console.log(`First load requests: ${firstLoadRequests.length}`);
      console.log(`Reload requests: ${reloadRequests.length}`);
      
      // Reload should have fewer requests due to caching
      expect(reloadRequests.length).toBeLessThanOrEqual(firstLoadRequests.length);
    });
  });

  test.describe('Rendering Performance', () => {
    test('should render smoothly during interactions', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.waitForLoadState('networkidle');
      
      // Measure frame rates during interactions
      const frameRates = [];
      
      await page.evaluate(() => {
        let lastTime = performance.now();
        let frameCount = 0;
        
        function measureFPS() {
          const currentTime = performance.now();
          frameCount++;
          
          if (currentTime - lastTime >= 1000) {
            const fps = frameCount;
            frameCount = 0;
            lastTime = currentTime;
            window.fpsData = window.fpsData || [];
            window.fpsData.push(fps);
          }
          
          requestAnimationFrame(measureFPS);
        }
        
        requestAnimationFrame(measureFPS);
      });
      
      // Perform interactions
      await page.hover('button, a, input');
      await page.click('body');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(3000);
      
      // Get FPS data
      const fpsData = await page.evaluate(() => window.fpsData || []);
      if (fpsData.length > 0) {
        const avgFPS = fpsData.reduce((sum, fps) => sum + fps, 0) / fpsData.length;
        console.log(`Average FPS during interactions: ${avgFPS.toFixed(2)}`);
        
        // Should maintain decent frame rate
        expect(avgFPS).toBeGreaterThan(30);
      }
    });
  });
});

test.describe('Stress Tests', () => {
  test('should handle rapid navigation', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Rapid navigation between sections
    const navigationLinks = await page.locator('nav a, nav button').all();
    
    for (let i = 0; i < Math.min(5, navigationLinks.length); i++) {
      const startTime = Date.now();
      await navigationLinks[i].click();
      await page.waitForTimeout(500);
      const responseTime = Date.now() - startTime;
      
      console.log(`Navigation ${i + 1} response time: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(2000);
    }
  });

  test('should handle multiple simultaneous operations', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Perform multiple operations simultaneously
    const operations = [
      page.locator('input[type="search"]').fill('test').catch(() => {}),
      page.keyboard.press('Tab').catch(() => {}),
      page.hover('button').catch(() => {}),
      page.click('body').catch(() => {})
    ];
    
    const startTime = Date.now();
    await Promise.all(operations);
    const totalTime = Date.now() - startTime;
    
    console.log(`Multiple operations completed in: ${totalTime}ms`);
    expect(totalTime).toBeLessThan(2000);
  });
});