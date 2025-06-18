import { test, expect } from '@playwright/test';

test.describe('Performance and Load Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Setup performance monitoring
    await page.addInitScript(() => {
      window.performanceMetrics = {
        navigationStart: performance.timeOrigin,
        loadEventEnd: 0,
        domContentLoaded: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        firstInputDelay: 0,
        cumulativeLayoutShift: 0,
      };

      // Monitor Core Web Vitals
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            if (entry.name === 'first-paint') {
              window.performanceMetrics.firstPaint = entry.startTime;
            }
            if (entry.name === 'first-contentful-paint') {
              window.performanceMetrics.firstContentfulPaint = entry.startTime;
            }
          }
          if (entry.entryType === 'largest-contentful-paint') {
            window.performanceMetrics.largestContentfulPaint = entry.startTime;
          }
          if (entry.entryType === 'layout-shift') {
            window.performanceMetrics.cumulativeLayoutShift += entry.value;
          }
        }
      }).observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift'] });

      // Monitor First Input Delay
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.performanceMetrics.firstInputDelay = entry.processingStart - entry.startTime;
        }
      }).observe({ entryTypes: ['first-input'] });

      // Monitor DOM Content Loaded
      document.addEventListener('DOMContentLoaded', () => {
        window.performanceMetrics.domContentLoaded = performance.now();
      });

      // Monitor Load Event
      window.addEventListener('load', () => {
        window.performanceMetrics.loadEventEnd = performance.now();
      });
    });

    // Login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should meet page load performance thresholds', async ({ page }) => {
    // Navigate to files page and measure performance
    const startTime = Date.now();
    await page.goto('/files');
    await page.waitForLoadState('networkidle');
    const endTime = Date.now();

    // Get performance metrics
    const metrics = await page.evaluate(() => window.performanceMetrics);
    const loadTime = endTime - startTime;

    // Assert performance thresholds
    expect(loadTime).toBeLessThan(3000); // Page should load within 3 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(1500); // FCP < 1.5s
    expect(metrics.largestContentfulPaint).toBeLessThan(2500); // LCP < 2.5s
    expect(metrics.firstInputDelay).toBeLessThan(100); // FID < 100ms
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1); // CLS < 0.1

    console.log('Performance Metrics:', {
      pageLoadTime: `${loadTime}ms`,
      firstContentfulPaint: `${metrics.firstContentfulPaint}ms`,
      largestContentfulPaint: `${metrics.largestContentfulPaint}ms`,
      firstInputDelay: `${metrics.firstInputDelay}ms`,
      cumulativeLayoutShift: metrics.cumulativeLayoutShift,
    });
  });

  test('should handle large file lists efficiently', async ({ page }) => {
    // Navigate to files page
    await page.goto('/files');

    // Measure time to render large file list
    const startTime = performance.now();
    
    // Simulate loading 1000+ files
    await page.evaluate(() => {
      // Mock API response with large dataset
      window.fetch = async (url) => {
        if (url.includes('/api/files')) {
          const files = Array.from({ length: 1000 }, (_, i) => ({
            id: `file-${i}`,
            name: `File ${i}.pdf`,
            size: Math.random() * 10000000,
            type: 'application/pdf',
            uploadDate: new Date().toISOString(),
            uploader: { firstName: 'User', lastName: `${i}` },
          }));
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ files, total: 1000 }),
          });
        }
        return originalFetch(url);
      };
    });

    // Trigger file list reload
    await page.click('[data-testid="refresh-files-button"]');
    await page.waitForSelector('[data-testid="file-list"]');
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Virtual scrolling should handle large lists efficiently
    expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds

    // Test scrolling performance
    const scrollStartTime = performance.now();
    await page.evaluate(() => {
      const fileList = document.querySelector('[data-testid="file-list"]');
      fileList.scrollTop = 10000; // Scroll down significantly
    });
    await page.waitForTimeout(500); // Wait for scroll to settle
    const scrollEndTime = performance.now();
    const scrollTime = scrollEndTime - scrollStartTime;

    expect(scrollTime).toBeLessThan(100); // Scrolling should be smooth
  });

  test('should handle concurrent file uploads efficiently', async ({ page }) => {
    await page.goto('/files');

    // Measure multiple file upload performance
    const uploadStartTime = performance.now();
    
    // Open upload modal
    await page.click('[data-testid="upload-file-button"]');
    await expect(page.locator('[data-testid="file-upload-modal"]')).toBeVisible();

    // Simulate uploading 10 files concurrently
    const filePromises = [];
    for (let i = 0; i < 10; i++) {
      const filePromise = page.evaluate((index) => {
        const file = new File([`content ${index}`], `test-file-${index}.txt`, {
          type: 'text/plain',
        });
        
        // Simulate file upload
        return fetch('/api/files/upload', {
          method: 'POST',
          body: new FormData().append('file', file),
        });
      }, i);
      filePromises.push(filePromise);
    }

    // Wait for all uploads to complete
    await Promise.all(filePromises);
    const uploadEndTime = performance.now();
    const totalUploadTime = uploadEndTime - uploadStartTime;

    // Concurrent uploads should complete efficiently
    expect(totalUploadTime).toBeLessThan(10000); // Within 10 seconds

    // Verify UI remains responsive during uploads
    const clickStartTime = performance.now();
    await page.click('[data-testid="upload-modal-close"]');
    const clickEndTime = performance.now();
    const clickResponseTime = clickEndTime - clickStartTime;

    expect(clickResponseTime).toBeLessThan(100); // UI should remain responsive
  });

  test('should handle search performance with large datasets', async ({ page }) => {
    await page.goto('/files');

    // Measure search performance
    const searchStartTime = performance.now();
    
    // Perform search
    await page.fill('[data-testid="search-input"]', 'document');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Wait for search results
    await page.waitForSelector('[data-testid="search-results"]');
    const searchEndTime = performance.now();
    const searchTime = searchEndTime - searchStartTime;

    // Search should return results quickly
    expect(searchTime).toBeLessThan(2000); // Within 2 seconds

    // Test search with filters
    const filterStartTime = performance.now();
    await page.click('[data-testid="advanced-search-button"]');
    await page.check('[data-testid="file-type-pdf"]');
    await page.click('[data-testid="apply-filters-button"]');
    await page.waitForSelector('[data-testid="search-results"]');
    const filterEndTime = performance.now();
    const filterTime = filterEndTime - filterStartTime;

    expect(filterTime).toBeLessThan(1500); // Filtered search within 1.5 seconds
  });

  test('should handle real-time collaboration performance', async ({ page, context }) => {
    // Open a file for collaboration
    await page.goto('/files');
    await page.click('[data-testid="file-item"]');
    await page.click('[data-testid="collaborate-button"]');

    // Measure WebSocket connection time
    const wsStartTime = performance.now();
    await page.waitForSelector('[data-testid="collaboration-session"]');
    const wsEndTime = performance.now();
    const wsConnectionTime = wsEndTime - wsStartTime;

    expect(wsConnectionTime).toBeLessThan(1000); // WebSocket connection within 1 second

    // Open second browser context to simulate another user
    const secondPage = await context.newPage();
    await secondPage.goto('/login');
    await secondPage.fill('[data-testid="email-input"]', 'user2@example.com');
    await secondPage.fill('[data-testid="password-input"]', 'password123');
    await secondPage.click('[data-testid="login-button"]');
    await secondPage.goto(page.url());

    // Measure collaboration message latency
    const messageStartTime = performance.now();
    await page.click('[data-testid="add-comment-button"]');
    await page.fill('[data-testid="comment-input"]', 'Test collaboration message');
    await page.click('[data-testid="submit-comment"]');

    // Wait for message to appear on second user's screen
    await secondPage.waitForSelector('[data-testid="comments-section"]:has-text("Test collaboration message")');
    const messageEndTime = performance.now();
    const messageLatency = messageEndTime - messageStartTime;

    expect(messageLatency).toBeLessThan(500); // Real-time message within 500ms

    await secondPage.close();
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    await page.goto('/files');

    // Monitor memory usage
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    // Perform memory-intensive operations
    for (let i = 0; i < 10; i++) {
      // Navigate between pages
      await page.goto('/teams');
      await page.goto('/projects');
      await page.goto('/files');
      
      // Perform search operations
      await page.fill('[data-testid="search-input"]', `search term ${i}`);
      await page.press('[data-testid="search-input"]', 'Enter');
      await page.waitForSelector('[data-testid="search-results"]');
      
      // Clear search
      await page.click('[data-testid="clear-search"]');
    }

    // Check final memory usage
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize : 0;
    });

    // Memory usage should not increase excessively
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePercentage = (memoryIncrease / initialMemory) * 100;

    expect(memoryIncreasePercentage).toBeLessThan(50); // Memory increase < 50%

    console.log('Memory Usage:', {
      initial: `${Math.round(initialMemory / 1024 / 1024)}MB`,
      final: `${Math.round(finalMemory / 1024 / 1024)}MB`,
      increase: `${Math.round(memoryIncrease / 1024 / 1024)}MB`,
      increasePercentage: `${memoryIncreasePercentage.toFixed(1)}%`,
    });
  });

  test('should handle network throttling gracefully', async ({ page, context }) => {
    // Simulate slow 3G network
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
      await route.continue();
    });

    // Navigate to files page with slow network
    const startTime = performance.now();
    await page.goto('/files');
    await page.waitForLoadState('networkidle');
    const endTime = performance.now();
    const loadTime = endTime - startTime;

    // Page should still be usable with slow network
    expect(loadTime).toBeLessThan(10000); // Within 10 seconds on slow network

    // Test progressive loading
    await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
    await page.waitForSelector('[data-testid="file-list"]');
    await expect(page.locator('[data-testid="loading-skeleton"]')).not.toBeVisible();

    // Test offline functionality
    await context.setOffline(true);
    await page.reload();

    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Should show cached content
    await expect(page.locator('[data-testid="cached-content"]')).toBeVisible();

    // Restore network
    await context.setOffline(false);
  });

  test('should handle large team collaboration efficiently', async ({ page, context }) => {
    // Navigate to a team with many members
    await page.goto('/teams/large-team');
    await page.click('[data-testid="team-files-tab"]');

    // Measure team file loading performance
    const startTime = performance.now();
    await page.waitForSelector('[data-testid="team-file-list"]');
    const endTime = performance.now();
    const loadTime = endTime - startTime;

    expect(loadTime).toBeLessThan(3000); // Team files load within 3 seconds

    // Test member presence updates
    const presenceStartTime = performance.now();
    
    // Simulate multiple team members coming online
    for (let i = 0; i < 5; i++) {
      await page.evaluate((index) => {
        // Simulate WebSocket message for user coming online
        const event = new MessageEvent('message', {
          data: JSON.stringify({
            type: 'user_online',
            userId: `user-${index}`,
            userName: `User ${index}`,
          }),
        });
        window.dispatchEvent(event);
      }, i);
    }

    await page.waitForSelector('[data-testid="online-members"]:has-text("5 online")');
    const presenceEndTime = performance.now();
    const presenceUpdateTime = presenceEndTime - presenceStartTime;

    expect(presenceUpdateTime).toBeLessThan(1000); // Presence updates within 1 second
  });

  test('should handle file preview performance', async ({ page }) => {
    await page.goto('/files');

    // Test image preview performance
    const imagePreviewStartTime = performance.now();
    await page.click('[data-testid="file-item"][data-file-type="image"]');
    await page.click('[data-testid="preview-button"]');
    await page.waitForSelector('[data-testid="image-preview"]');
    const imagePreviewEndTime = performance.now();
    const imagePreviewTime = imagePreviewEndTime - imagePreviewStartTime;

    expect(imagePreviewTime).toBeLessThan(2000); // Image preview within 2 seconds

    // Test document preview performance
    await page.click('[data-testid="preview-close"]');
    const docPreviewStartTime = performance.now();
    await page.click('[data-testid="file-item"][data-file-type="pdf"]');
    await page.click('[data-testid="preview-button"]');
    await page.waitForSelector('[data-testid="document-preview"]');
    const docPreviewEndTime = performance.now();
    const docPreviewTime = docPreviewEndTime - docPreviewStartTime;

    expect(docPreviewTime).toBeLessThan(3000); // Document preview within 3 seconds

    // Test preview navigation performance
    const navStartTime = performance.now();
    await page.click('[data-testid="preview-next"]');
    await page.waitForSelector('[data-testid="preview-content"]');
    const navEndTime = performance.now();
    const navTime = navEndTime - navStartTime;

    expect(navTime).toBeLessThan(500); // Preview navigation within 500ms
  });

  test('should maintain performance during stress testing', async ({ page }) => {
    await page.goto('/files');

    // Stress test: Rapid user interactions
    const stressTestStartTime = performance.now();
    
    for (let i = 0; i < 50; i++) {
      // Rapid clicking and navigation
      await page.click('[data-testid="file-item"]');
      await page.press('body', 'Escape'); // Close any modals
      
      // Quick search operations
      await page.fill('[data-testid="search-input"]', `test ${i}`);
      await page.press('[data-testid="search-input"]', 'Escape');
      
      // Sort operations
      if (i % 10 === 0) {
        await page.click('[data-testid="sort-dropdown"]');
        await page.click('[data-testid="sort-name"]');
      }
    }

    const stressTestEndTime = performance.now();
    const stressTestTime = stressTestEndTime - stressTestStartTime;

    // UI should remain responsive during stress test
    expect(stressTestTime).toBeLessThan(30000); // Complete within 30 seconds

    // Test UI responsiveness after stress test
    const responsivenessStartTime = performance.now();
    await page.click('[data-testid="upload-file-button"]');
    await page.waitForSelector('[data-testid="file-upload-modal"]');
    const responsivenessEndTime = performance.now();
    const responsivenessTime = responsivenessEndTime - responsivenessStartTime;

    expect(responsivenessTime).toBeLessThan(500); // UI still responsive
  });
});