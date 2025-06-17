// Test cho Local Storage và Upload functionality
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Local Storage và Upload Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Đi tới trang chủ
    await page.goto('/');
    
    // Chờ trang load xong
    await page.waitForLoadState('networkidle');
    
    // Xóa localStorage trước mỗi test
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('Kiểm tra giao diện Local File Manager', async ({ page }) => {
    // Tìm Local File Manager component
    const localFileManager = page.locator('[data-testid="local-file-manager"], .local-file-manager').first();
    
    // Nếu không tìm thấy bằng test-id, tìm bằng text
    const localStorageHeading = page.getByText('Local Storage').first();
    await expect(localStorageHeading).toBeVisible();
    
    // Kiểm tra storage info hiển thị
    const storageInfo = page.locator('text=Storage Used').first();
    await expect(storageInfo).toBeVisible();
    
    // Kiểm tra progress bar
    const progressBar = page.locator('[role="progressbar"]').first();
    await expect(progressBar).toBeVisible();
  });

  test('Mở File Upload Modal', async ({ page }) => {
    // Tìm nút Upload
    const uploadButton = page.getByRole('button', { name: /upload/i }).first();
    await uploadButton.click();
    
    // Kiểm tra modal mở
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    
    // Kiểm tra tiêu đề
    const modalTitle = page.getByText('Upload Files');
    await expect(modalTitle).toBeVisible();
  });

  test('Chuyển đổi giữa Server và Local mode', async ({ page }) => {
    // Mở upload modal
    const uploadButton = page.getByRole('button', { name: /upload/i }).first();
    await uploadButton.click();
    
    // Kiểm tra nút Server và Local
    const serverButton = page.getByRole('button', { name: 'Server' });
    const localButton = page.getByRole('button', { name: 'Local' });
    
    await expect(serverButton).toBeVisible();
    await expect(localButton).toBeVisible();
    
    // Click vào Local mode
    await localButton.click();
    
    // Kiểm tra thông báo local storage xuất hiện
    const localStorageAlert = page.locator('text=Files will be stored locally');
    await expect(localStorageAlert).toBeVisible();
  });

  test('Upload file vào Local Storage', async ({ page }) => {
    // Tạo file test
    const testContent = 'This is a test file for local storage';
    const testFilePath = path.join(__dirname, 'fixtures', 'test-file.txt');
    
    // Mở upload modal
    const uploadButton = page.getByRole('button', { name: /upload/i }).first();
    await uploadButton.click();
    
    // Chuyển sang Local mode
    const localButton = page.getByRole('button', { name: 'Local' });
    await localButton.click();
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    
    // Tạo file tạm thời trong browser
    await page.evaluate(() => {
      const file = new File(['Test content for local storage'], 'test-local-file.txt', {
        type: 'text/plain'
      });
      
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Kiểm tra file xuất hiện trong danh sách
    const fileName = page.getByText('test-local-file.txt');
    await expect(fileName).toBeVisible();
    
    // Click upload
    const uploadFileButton = page.getByRole('button', { name: /Upload to Local Storage/i });
    await uploadFileButton.click();
    
    // Chờ upload hoàn thành
    await page.waitForTimeout(2000);
    
    // Kiểm tra success status
    const successIcon = page.locator('[data-lucide="check-circle"]');
    await expect(successIcon).toBeVisible();
  });

  test('Kiểm tra validation file size', async ({ page }) => {
    // Mở upload modal
    const uploadButton = page.getByRole('button', { name: /upload/i }).first();
    await uploadButton.click();
    
    // Chuyển sang Local mode
    const localButton = page.getByRole('button', { name: 'Local' });
    await localButton.click();
    
    // Tạo file lớn hơn giới hạn
    await page.evaluate(() => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024); // 6MB file
      const file = new File([largeContent], 'large-file.txt', {
        type: 'text/plain'
      });
      
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Chờ validation
    await page.waitForTimeout(1000);
    
    // Kiểm tra error message
    const errorMessage = page.getByText(/File size exceeds.*MB limit/);
    await expect(errorMessage).toBeVisible();
  });

  test('Kiểm tra validation file type', async ({ page }) => {
    // Mở upload modal
    const uploadButton = page.getByRole('button', { name: /upload/i }).first();
    await uploadButton.click();
    
    // Chuyển sang Local mode
    const localButton = page.getByRole('button', { name: 'Local' });
    await localButton.click();
    
    // Tạo file với type không được hỗ trợ
    await page.evaluate(() => {
      const file = new File(['Invalid file content'], 'test-file.xyz', {
        type: 'application/xyz'
      });
      
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Chờ validation
    await page.waitForTimeout(1000);
    
    // Kiểm tra error message
    const errorMessage = page.getByText(/File type.*is not supported/);
    await expect(errorMessage).toBeVisible();
  });

  test('Kiểm tra Local File Manager hiển thị file đã upload', async ({ page }) => {
    // Mô phỏng đã có file trong localStorage
    await page.evaluate(() => {
      const mockFile = {
        id: 'test-file-1',
        name: 'mock-file.txt',
        size: 1024,
        type: 'text/plain',
        data: btoa('Mock file content'),
        uploadDate: new Date().toISOString(),
        lastModified: Date.now()
      };
      
      const storageData = {
        files: [mockFile],
        settings: {
          maxFileSize: 5 * 1024 * 1024,
          allowedTypes: ['text/plain'],
          compressionQuality: 0.8
        }
      };
      
      localStorage.setItem('fileFlowMaster', JSON.stringify(storageData));
    });
    
    // Refresh trang để load dữ liệu
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Kiểm tra file hiển thị trong Local File Manager
    const fileName = page.getByText('mock-file.txt');
    await expect(fileName).toBeVisible();
    
    // Kiểm tra file size
    const fileSize = page.getByText('1.00 KB');
    await expect(fileSize).toBeVisible();
    
    // Kiểm tra badge "Local"
    const localBadge = page.getByText('Local');
    await expect(localBadge).toBeVisible();
  });

  test('Kiểm tra download file từ Local Storage', async ({ page }) => {
    // Mô phỏng file trong localStorage
    await page.evaluate(() => {
      const mockFile = {
        id: 'download-test-file',
        name: 'download-test.txt',
        size: 1024,
        type: 'text/plain',
        data: btoa('Content to download'),
        uploadDate: new Date().toISOString(),
        lastModified: Date.now()
      };
      
      const storageData = {
        files: [mockFile],
        settings: {
          maxFileSize: 5 * 1024 * 1024,
          allowedTypes: ['text/plain'],
          compressionQuality: 0.8
        }
      };
      
      localStorage.setItem('fileFlowMaster', JSON.stringify(storageData));
    });
    
    // Refresh trang
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Setup download listener
    const downloadPromise = page.waitForEvent('download');
    
    // Click download button
    const downloadButton = page.locator('[title="Download file"]').first();
    await downloadButton.click();
    
    // Verify download
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('download-test.txt');
  });

  test('Kiểm tra xóa file từ Local Storage', async ({ page }) => {
    // Mô phỏng file trong localStorage
    await page.evaluate(() => {
      const mockFile = {
        id: 'delete-test-file',
        name: 'delete-test.txt',
        size: 1024,
        type: 'text/plain',
        data: btoa('Content to delete'),
        uploadDate: new Date().toISOString(),
        lastModified: Date.now()
      };
      
      const storageData = {
        files: [mockFile],
        settings: {
          maxFileSize: 5 * 1024 * 1024,
          allowedTypes: ['text/plain'],
          compressionQuality: 0.8
        }
      };
      
      localStorage.setItem('fileFlowMaster', JSON.stringify(storageData));
    });
    
    // Refresh trang
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify file exists
    const fileName = page.getByText('delete-test.txt');
    await expect(fileName).toBeVisible();
    
    // Setup dialog handler
    page.on('dialog', dialog => dialog.accept());
    
    // Click delete button
    const deleteButton = page.locator('[title="Delete file"]').first();
    await deleteButton.click();
    
    // Verify file is removed
    await expect(fileName).not.toBeVisible();
  });

  test('Kiểm tra storage usage warning', async ({ page }) => {
    // Mô phỏng storage gần đầy
    await page.evaluate(() => {
      const largeData = 'x'.repeat(42 * 1024 * 1024); // 42MB data
      const mockFile = {
        id: 'large-file',
        name: 'large-file.txt',
        size: 42 * 1024 * 1024,
        type: 'text/plain',
        data: btoa(largeData),
        uploadDate: new Date().toISOString(),
        lastModified: Date.now()
      };
      
      const storageData = {
        files: [mockFile],
        settings: {
          maxFileSize: 50 * 1024 * 1024,
          allowedTypes: ['text/plain'],
          compressionQuality: 0.8
        }
      };
      
      localStorage.setItem('fileFlowMaster', JSON.stringify(storageData));
    });
    
    // Refresh trang
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Kiểm tra warning message
    const warningMessage = page.getByText(/Storage is nearly full/);
    await expect(warningMessage).toBeVisible();
    
    // Kiểm tra progress bar gần đầy
    const progressBar = page.locator('[role="progressbar"]').first();
    const progressValue = await progressBar.getAttribute('aria-valuenow');
    expect(parseInt(progressValue)).toBeGreaterThan(80);
  });

});