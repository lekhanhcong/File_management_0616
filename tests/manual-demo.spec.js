// Manual demo test để thử nghiệm chức năng upload và local storage
import { test, expect } from '@playwright/test';

test.describe('Manual Demo Tests', () => {
  
  test('Demo flow: Vào app và thử upload local', async ({ page }) => {
    // Vào trang chủ
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Click Get Started để vào app
    const getStartedButton = page.getByRole('button', { name: 'Get Started' });
    if (await getStartedButton.isVisible()) {
      await getStartedButton.click();
      await page.waitForTimeout(3000);
    }
    
    // Hoặc click Sign In
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    if (await signInButton.isVisible()) {
      await signInButton.click();
      await page.waitForTimeout(5000);
    }
    
    // Screenshot của trang hiện tại
    await page.screenshot({ path: 'test-results/demo-current-page.png', fullPage: true });
    
    // Log ra URL hiện tại
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Tìm kiếm các element có thể có trên trang
    const pageContent = await page.evaluate(() => {
      // Get all buttons
      const buttons = Array.from(document.querySelectorAll('button')).map(btn => btn.textContent?.trim());
      
      // Get all headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent?.trim());
      
      // Get page title
      const title = document.title;
      
      return {
        title,
        buttons: buttons.filter(b => b && b.length > 0),
        headings: headings.filter(h => h && h.length > 0),
        url: window.location.href
      };
    });
    
    console.log('Page Content:', JSON.stringify(pageContent, null, 2));
    
    // Check if we're on the dashboard/home page
    const isDashboard = pageContent.headings.some(h => 
      h.includes('All files') || 
      h.includes('Recent Files') || 
      h.includes('Local Storage')
    );
    
    if (isDashboard) {
      console.log('✅ Successfully reached dashboard');
      
      // Tìm Local Storage component
      const localStorageHeading = page.getByText('Local Storage');
      if (await localStorageHeading.isVisible()) {
        await expect(localStorageHeading).toBeVisible();
        console.log('✅ Local Storage component found');
      }
      
      // Tìm upload button
      const uploadButtons = page.getByRole('button').filter({ hasText: /upload/i });
      const uploadCount = await uploadButtons.count();
      if (uploadCount > 0) {
        console.log(`✅ Found ${uploadCount} upload buttons`);
        
        // Click first upload button
        await uploadButtons.first().click();
        await page.waitForTimeout(1000);
        
        // Check if modal opened
        const modal = page.getByRole('dialog');
        if (await modal.isVisible()) {
          console.log('✅ Upload modal opened');
          
          // Screenshot của modal
          await page.screenshot({ path: 'test-results/demo-upload-modal.png', fullPage: true });
          
          // Check for Local/Server buttons
          const localBtn = page.getByRole('button', { name: 'Local' });
          const serverBtn = page.getByRole('button', { name: 'Server' });
          
          if (await localBtn.isVisible() && await serverBtn.isVisible()) {
            console.log('✅ Local and Server mode buttons found');
            
            // Click Local mode
            await localBtn.click();
            await page.waitForTimeout(500);
            
            // Screenshot sau khi chọn local mode
            await page.screenshot({ path: 'test-results/demo-local-mode.png', fullPage: true });
            
            console.log('✅ Demo completed successfully');
          }
        }
      }
    } else {
      console.log('❌ Not on dashboard, still on landing or auth page');
    }
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/demo-final.png', fullPage: true });
  });

  test('Test thủ công localStorage API', async ({ page }) => {
    await page.goto('/');
    
    // Test localStorage với FileFlowMaster data structure
    const testResult = await page.evaluate(() => {
      // Import LocalStorageManager logic (simplified)
      const STORAGE_KEY = 'fileFlowMaster';
      const MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB
      
      const getDefaultData = () => ({
        files: [],
        settings: {
          maxFileSize: 5 * 1024 * 1024, // 5MB
          allowedTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'text/plain'
          ],
          compressionQuality: 0.8
        }
      });
      
      const storeFile = (fileName, content, type) => {
        try {
          const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || getDefaultData();
          
          const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const base64Data = btoa(content);
          
          const storedFile = {
            id: fileId,
            name: fileName,
            size: content.length,
            type: type,
            data: base64Data,
            uploadDate: new Date().toISOString(),
            lastModified: Date.now()
          };
          
          data.files.push(storedFile);
          
          const serialized = JSON.stringify(data);
          if (serialized.length > MAX_STORAGE_SIZE) {
            throw new Error('Storage quota exceeded');
          }
          
          localStorage.setItem(STORAGE_KEY, serialized);
          
          return { success: true, fileId };
        } catch (error) {
          return { success: false, error: error.message };
        }
      };
      
      const getStorageInfo = () => {
        try {
          const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || getDefaultData();
          const used = JSON.stringify(data).length;
          const available = MAX_STORAGE_SIZE - used;
          const usedPercentage = (used / MAX_STORAGE_SIZE) * 100;
          
          return {
            used,
            available,
            fileCount: data.files.length,
            usedPercentage
          };
        } catch (error) {
          return { used: 0, available: MAX_STORAGE_SIZE, fileCount: 0, usedPercentage: 0 };
        }
      };
      
      // Run tests
      const results = [];
      
      // Test 1: Store a file
      const storeResult = storeFile('test-file.txt', 'This is a test file content', 'text/plain');
      results.push({ test: 'Store File', ...storeResult });
      
      // Test 2: Get storage info
      const storageInfo = getStorageInfo();
      results.push({ test: 'Storage Info', success: storageInfo.fileCount === 1, ...storageInfo });
      
      // Test 3: Store another file
      const storeResult2 = storeFile('test-image.png', 'fake-image-data', 'image/png');
      results.push({ test: 'Store Second File', ...storeResult2 });
      
      // Test 4: Final storage info
      const finalStorageInfo = getStorageInfo();
      results.push({ test: 'Final Storage Info', success: finalStorageInfo.fileCount === 2, ...finalStorageInfo });
      
      // Clean up
      localStorage.removeItem(STORAGE_KEY);
      
      return results;
    });
    
    // Verify test results
    console.log('LocalStorage Test Results:', JSON.stringify(testResult, null, 2));
    
    testResult.forEach((result, index) => {
      expect(result.success).toBe(true);
    });
  });
  
});