import { test, expect } from '@playwright/test';

test.describe('Simple FileFlowMaster Tests', () => {
  test('should connect to the server', async ({ page }) => {
    // Test that server is running and responding
    await page.goto('http://localhost:3001');
    
    // Check if we get a response (even if it's just the HTML)
    const title = await page.title();
    console.log('Page title:', title);
    
    // The important thing is that the server responds
    expect(page.url()).toContain('localhost:3001');
  });

  test('should access API endpoints', async ({ page }) => {
    // Test API is working
    const response = await page.request.get('http://localhost:3001/api/files');
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('files');
    expect(json.files).toBeInstanceOf(Array);
  });

  test('should serve static assets', async ({ page }) => {
    // Test that CSS and JS are loading
    await page.goto('http://localhost:3001');
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Check if React root element exists
    const root = page.locator('#root');
    await expect(root).toBeAttached();
  });
});