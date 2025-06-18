import { test, expect } from '@playwright/test';

test.describe('Basic E2E Tests', () => {
  test('should load the homepage', async ({ page }) => {
    // Start from the index page (app runs on localhost:3001)
    await page.goto('http://localhost:3001');
    
    // Check if page loads successfully
    await expect(page).toHaveURL('http://localhost:3001/');
    
    // Check if root element exists
    const root = page.locator('#root');
    await expect(root).toBeVisible();
  });

  test('should handle API endpoint', async ({ page }) => {
    // Test API response
    const response = await page.request.get('http://localhost:3001/api/files');
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json).toHaveProperty('files');
    expect(json).toHaveProperty('total');
  });
});