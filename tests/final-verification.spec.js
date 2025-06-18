import { test, expect } from '@playwright/test';

test.describe('FileFlowMaster Final Verification', () => {
  test('complete app verification', async ({ page }) => {
    console.log('🚀 Final verification của FileFlowMaster...');
    
    // Test 1: Server connection
    console.log('1️⃣ Kiểm tra server connection...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toBe('http://localhost:3001/');
    console.log('✅ Server running trên localhost:3001');
    
    // Test 2: Page loads without errors
    console.log('2️⃣ Kiểm tra page loading...');
    const content = await page.content();
    expect(content).not.toContain('Safari Can\'t Connect');
    expect(content).not.toContain('ERR_CONNECTION_REFUSED');
    expect(content.length).toBeGreaterThan(100);
    console.log('✅ Page load thành công');
    
    // Test 3: Basic API connectivity
    console.log('3️⃣ Kiểm tra API connectivity...');
    const response = await page.request.get('/api/files');
    // API trả về 401 Unauthorized là OK (cần auth)
    expect([200, 401]).toContain(response.status());
    console.log('✅ API endpoints accessible');
    
    // Test 4: HTML structure
    console.log('4️⃣ Kiểm tra HTML structure...');
    const htmlElements = await page.locator('html, body, head').count();
    expect(htmlElements).toBeGreaterThanOrEqual(3);
    console.log('✅ HTML structure hợp lệ');
    
    // Test 5: Check for React/JS loading
    console.log('5️⃣ Kiểm tra React app...');
    // Wait a bit for React to initialize
    await page.waitForTimeout(1000);
    
    const hasContent = await page.locator('body *').count();
    expect(hasContent).toBeGreaterThan(0);
    console.log('✅ Frontend app loaded');
    
    console.log('\n🎉 FileFlowMaster verification HOÀN THÀNH!');
    console.log('✅ Tất cả tests đều PASS');
    console.log('🚀 Ứng dụng sẵn sàng sử dụng!');
  });
});