import { test, expect } from '@playwright/test';

test.describe('FileFlowMaster Verification', () => {
  test('should connect to server successfully', async ({ page }) => {
    console.log('🔍 Testing server connection...');
    
    // Go to homepage
    await page.goto('/');
    
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Check URL
    expect(page.url()).toBe('http://localhost:3001/');
    
    // Verify page loaded without connection errors
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Safari Can\'t Connect');
    expect(pageContent).not.toContain('This site can\'t be reached');
    expect(pageContent).not.toContain('ERR_CONNECTION_REFUSED');
    
    console.log('✅ Server connection successful');
  });

  test('should have working API endpoints', async ({ page }) => {
    console.log('🔍 Testing API endpoints...');
    
    // Test files API
    const apiResponse = await page.request.get('/api/files');
    expect(apiResponse.ok()).toBeTruthy();
    expect(apiResponse.status()).toBe(200);
    
    const data = await apiResponse.json();
    expect(data).toHaveProperty('files');
    expect(Array.isArray(data.files)).toBeTruthy();
    expect(data).toHaveProperty('total');
    expect(typeof data.total).toBe('number');
    
    console.log('✅ API endpoints working correctly');
  });

  test('should serve static content', async ({ page }) => {
    console.log('🔍 Testing static content serving...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify basic HTML structure
    const htmlCount = await page.locator('html').count();
    expect(htmlCount).toBe(1);
    
    const bodyCount = await page.locator('body').count();
    expect(bodyCount).toBe(1);
    
    // Check if we have some content (not just empty page)
    const bodyContent = await page.locator('body').textContent();
    expect(bodyContent.length).toBeGreaterThan(0);
    
    console.log('✅ Static content served correctly');
  });

  test('should handle React app properly', async ({ page }) => {
    console.log('🔍 Testing React app loading...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Give React time to initialize
    await page.waitForTimeout(2000);
    
    // Check for React-specific elements or patterns
    const hasReactRoot = await page.locator('#root').count() > 0;
    const hasMainContent = await page.locator('main, .app, [data-testid]').count() > 0;
    const hasAnyStructure = await page.locator('body > div, body > main, body > section').count() > 0;
    
    // At least one of these should be true for a properly loaded React app
    expect(hasReactRoot || hasMainContent || hasAnyStructure).toBeTruthy();
    
    console.log('✅ React app structure detected');
  });
});