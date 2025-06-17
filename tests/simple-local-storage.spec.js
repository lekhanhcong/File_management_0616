// Simple test cho Local Storage functionality
import { test, expect } from '@playwright/test';

test.describe('Simple Local Storage Tests', () => {
  
  test('Kiểm tra landing page load', async ({ page }) => {
    await page.goto('/');
    
    // Kiểm tra landing page hiển thị
    const heading = page.getByText('Enterprise-Grade File Management');
    await expect(heading).toBeVisible();
    
    // Kiểm tra nút Get Started
    const getStartedButton = page.getByRole('button', { name: 'Get Started' });
    await expect(getStartedButton).toBeVisible();
  });

  test('Kiểm tra Sign In button và redirect', async ({ page }) => {
    await page.goto('/');
    
    // Click Sign In
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await signInButton.click();
    
    // Chờ redirect
    await page.waitForTimeout(2000);
    
    // Verify redirect occurred (URL should change)
    const currentUrl = page.url();
    expect(currentUrl).not.toBe('http://localhost:3001/');
  });

  test('Test localStorage functionality trực tiếp', async ({ page }) => {
    await page.goto('/');
    
    // Test localStorage functionality bằng JavaScript
    const localStorageTest = await page.evaluate(() => {
      // Test localStorage API
      const testKey = 'fileFlowMaster-test';
      const testData = {
        files: [{
          id: 'test-1',
          name: 'test-file.txt',
          size: 1024,
          type: 'text/plain',
          data: btoa('test content'),
          uploadDate: new Date().toISOString(),
          lastModified: Date.now()
        }],
        settings: {
          maxFileSize: 5 * 1024 * 1024,
          allowedTypes: ['text/plain'],
          compressionQuality: 0.8
        }
      };
      
      try {
        // Test write
        localStorage.setItem(testKey, JSON.stringify(testData));
        
        // Test read
        const retrievedData = JSON.parse(localStorage.getItem(testKey));
        
        // Test delete
        localStorage.removeItem(testKey);
        
        return {
          success: true,
          writeTest: true,
          readTest: retrievedData.files.length === 1,
          deleteTest: localStorage.getItem(testKey) === null
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    expect(localStorageTest.success).toBe(true);
    expect(localStorageTest.writeTest).toBe(true);
    expect(localStorageTest.readTest).toBe(true);
    expect(localStorageTest.deleteTest).toBe(true);
  });

  test('Test file validation logic', async ({ page }) => {
    await page.goto('/');
    
    const validationTest = await page.evaluate(() => {
      // Simulate file validation logic
      const validateFile = (file) => {
        const maxSize = 5 * 1024 * 1024; // 5MB
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ];
        
        if (file.size > maxSize) {
          return {
            isValid: false,
            error: `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`
          };
        }
        
        if (!allowedTypes.includes(file.type)) {
          return {
            isValid: false,
            error: `File type ${file.type} is not supported`
          };
        }
        
        return { isValid: true };
      };
      
      // Test cases
      const validFile = { size: 1024, type: 'text/plain' };
      const tooLargeFile = { size: 6 * 1024 * 1024, type: 'text/plain' };
      const invalidTypeFile = { size: 1024, type: 'application/exe' };
      
      return {
        validFile: validateFile(validFile),
        tooLargeFile: validateFile(tooLargeFile),
        invalidTypeFile: validateFile(invalidTypeFile)
      };
    });
    
    expect(validationTest.validFile.isValid).toBe(true);
    expect(validationTest.tooLargeFile.isValid).toBe(false);
    expect(validationTest.tooLargeFile.error).toContain('size exceeds');
    expect(validationTest.invalidTypeFile.isValid).toBe(false);
    expect(validationTest.invalidTypeFile.error).toContain('not supported');
  });

  test('Test file to base64 conversion', async ({ page }) => {
    await page.goto('/');
    
    const base64Test = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Create test file
        const testContent = 'This is test file content';
        const file = new File([testContent], 'test.txt', { type: 'text/plain' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          const base64 = result.split(',')[1]; // Remove data:mime;base64, prefix
          
          // Convert back to verify
          const decoded = atob(base64);
          
          resolve({
            success: decoded === testContent,
            originalLength: testContent.length,
            decodedLength: decoded.length,
            base64Length: base64.length
          });
        };
        reader.onerror = () => resolve({ success: false, error: 'FileReader error' });
        reader.readAsDataURL(file);
      });
    });
    
    expect(base64Test.success).toBe(true);
    expect(base64Test.originalLength).toBe(base64Test.decodedLength);
  });

  test('Test storage quota simulation', async ({ page }) => {
    await page.goto('/');
    
    const quotaTest = await page.evaluate(() => {
      const maxStorage = 50 * 1024 * 1024; // 50MB
      
      // Simulate storage calculation
      const calculateUsage = (files) => {
        const data = { files, settings: {} };
        const used = JSON.stringify(data).length;
        const available = maxStorage - used;
        const usedPercentage = (used / maxStorage) * 100;
        
        return {
          used,
          available,
          fileCount: files.length,
          usedPercentage
        };
      };
      
      // Test with no files
      const emptyUsage = calculateUsage([]);
      
      // Test with some files
      const someFiles = [
        { id: '1', name: 'file1.txt', data: 'x'.repeat(1000) },
        { id: '2', name: 'file2.txt', data: 'x'.repeat(2000) }
      ];
      const someUsage = calculateUsage(someFiles);
      
      return {
        emptyUsage,
        someUsage,
        maxStorage
      };
    });
    
    expect(quotaTest.emptyUsage.fileCount).toBe(0);
    expect(quotaTest.emptyUsage.usedPercentage).toBeGreaterThanOrEqual(0);
    expect(quotaTest.someUsage.fileCount).toBe(2);
    expect(quotaTest.someUsage.usedPercentage).toBeGreaterThan(quotaTest.emptyUsage.usedPercentage);
  });

});