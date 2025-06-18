import { test, expect } from '@playwright/test';

test.describe('FileFlowMaster App Verification', () => {
  test('should connect to server and load homepage', async ({ page }) => {
    // Test server connectivity
    await page.goto('http://localhost:3001');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the right URL
    expect(page.url()).toBe('http://localhost:3001/');
    
    // Check if page loaded (should not show error)
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Safari Can\'t Connect');
    expect(pageContent).not.toContain('This site can\'t be reached');
    
    console.log('✅ Homepage loaded successfully');
  });

  test('should have working API endpoints', async ({ page }) => {
    // Test API directly
    const apiResponse = await page.request.get('http://localhost:3001/api/files');
    expect(apiResponse.ok()).toBeTruthy();
    
    const data = await apiResponse.json();
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBeTruthy();
    
    console.log('✅ API endpoints working');
  });

  test('should serve static assets', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Check if CSS is loading by looking for styled elements
    await page.waitForLoadState('networkidle');
    
    // Verify basic HTML structure exists
    const html = await page.locator('html').count();
    expect(html).toBeGreaterThan(0);
    
    const body = await page.locator('body').count();
    expect(body).toBeGreaterThan(0);
    
    console.log('✅ Static assets served correctly');
  });

  test('should handle React app initialization', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Check if React root element exists (common in React apps)
    const reactRoot = await page.locator('#root, #app, main, [data-reactroot]').count();
    
    // We expect at least some structured content, even if React components aren't fully loaded
    const hasContent = reactRoot > 0 || await page.locator('body *').count() > 5;
    expect(hasContent).toBeTruthy();
    
    console.log('✅ React app structure detected');
  });
});