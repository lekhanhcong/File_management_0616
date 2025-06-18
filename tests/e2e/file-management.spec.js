import { test, expect } from '@playwright/test';

test.describe('File Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test user and login
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for successful login and navigation to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('should upload a file successfully', async ({ page }) => {
    // Navigate to files section
    await page.click('[data-testid="files-nav-link"]');
    await expect(page).toHaveURL('/files');

    // Click upload button
    await page.click('[data-testid="upload-file-button"]');
    
    // Wait for upload modal to appear
    await expect(page.locator('[data-testid="file-upload-modal"]')).toBeVisible();

    // Upload a test file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('PDF test content'),
    });

    // Fill in file details
    await page.fill('[data-testid="file-description"]', 'Test PDF document for E2E testing');
    await page.fill('[data-testid="file-tags"]', 'test, document, e2e');

    // Submit upload
    await page.click('[data-testid="upload-submit-button"]');

    // Wait for upload completion
    await expect(page.locator('[data-testid="upload-success-message"]')).toBeVisible();
    
    // Close modal
    await page.click('[data-testid="upload-modal-close"]');

    // Verify file appears in file list
    await expect(page.locator('[data-testid="file-list"]')).toContainText('test-document.pdf');
    await expect(page.locator('[data-testid="file-item"]').first()).toContainText('Test PDF document for E2E testing');
  });

  test('should search and filter files', async ({ page }) => {
    // Navigate to files section
    await page.click('[data-testid="files-nav-link"]');

    // Use search functionality
    await page.fill('[data-testid="file-search-input"]', 'test');
    await page.press('[data-testid="file-search-input"]', 'Enter');

    // Wait for search results
    await page.waitForSelector('[data-testid="search-results"]');
    
    // Verify search results contain the term
    const searchResults = page.locator('[data-testid="file-item"]');
    await expect(searchResults.first()).toContainText('test');

    // Test file type filter
    await page.click('[data-testid="filter-dropdown"]');
    await page.click('[data-testid="filter-documents"]');
    
    // Verify filter is applied
    await expect(page.locator('[data-testid="active-filter-badge"]')).toContainText('Documents');
    
    // Clear filters
    await page.click('[data-testid="clear-filters-button"]');
    await expect(page.locator('[data-testid="active-filter-badge"]')).not.toBeVisible();
  });

  test('should view file details', async ({ page }) => {
    // Navigate to files and click on a file
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="file-item"]');

    // Wait for file details modal/page
    await expect(page.locator('[data-testid="file-details-modal"]')).toBeVisible();

    // Verify file information is displayed
    await expect(page.locator('[data-testid="file-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-size"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-uploader"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-upload-date"]')).toBeVisible();

    // Test file actions
    await expect(page.locator('[data-testid="download-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="share-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-button"]')).toBeVisible();
  });

  test('should share a file', async ({ page }) => {
    // Navigate to files and open share dialog
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="file-item"] [data-testid="share-button"]');

    // Wait for share modal
    await expect(page.locator('[data-testid="share-modal"]')).toBeVisible();

    // Test public sharing
    await page.check('[data-testid="make-public-checkbox"]');
    await expect(page.locator('[data-testid="public-link"]')).toBeVisible();

    // Test user-specific sharing
    await page.uncheck('[data-testid="make-public-checkbox"]');
    await page.fill('[data-testid="share-email-input"]', 'colleague@example.com');
    await page.click('[data-testid="add-user-button"]');

    // Verify user is added to share list
    await expect(page.locator('[data-testid="shared-users-list"]')).toContainText('colleague@example.com');

    // Set permissions
    await page.click('[data-testid="permission-dropdown"]');
    await page.click('[data-testid="permission-edit"]');

    // Save share settings
    await page.click('[data-testid="save-share-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="share-success-message"]')).toBeVisible();
  });

  test('should edit file metadata', async ({ page }) => {
    // Navigate to files and open edit dialog
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="file-item"] [data-testid="edit-button"]');

    // Wait for edit modal
    await expect(page.locator('[data-testid="edit-file-modal"]')).toBeVisible();

    // Update file name
    await page.fill('[data-testid="file-name-input"]', 'updated-test-document.pdf');
    
    // Update description
    await page.fill('[data-testid="file-description-input"]', 'Updated description for testing');

    // Update tags
    await page.fill('[data-testid="file-tags-input"]', 'updated, test, document');

    // Save changes
    await page.click('[data-testid="save-changes-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="edit-success-message"]')).toBeVisible();

    // Close modal and verify changes
    await page.click('[data-testid="edit-modal-close"]');
    await expect(page.locator('[data-testid="file-list"]')).toContainText('updated-test-document.pdf');
  });

  test('should star and unstar files', async ({ page }) => {
    // Navigate to files
    await page.click('[data-testid="files-nav-link"]');

    // Star a file
    await page.click('[data-testid="file-item"] [data-testid="star-button"]');
    
    // Verify file is starred
    await expect(page.locator('[data-testid="file-item"] [data-testid="star-icon"]')).toHaveClass(/starred/);

    // Navigate to starred files
    await page.click('[data-testid="starred-files-filter"]');
    await expect(page.locator('[data-testid="file-item"]')).toBeVisible();

    // Unstar the file
    await page.click('[data-testid="file-item"] [data-testid="star-button"]');
    
    // Verify file is removed from starred list
    await expect(page.locator('[data-testid="file-item"]')).not.toBeVisible();
  });

  test('should delete a file', async ({ page }) => {
    // Navigate to files
    await page.click('[data-testid="files-nav-link"]');

    // Open file menu and click delete
    await page.click('[data-testid="file-item"] [data-testid="file-menu-button"]');
    await page.click('[data-testid="delete-file-option"]');

    // Confirm deletion in dialog
    await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
    await page.click('[data-testid="confirm-delete-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="delete-success-message"]')).toBeVisible();

    // Verify file is removed from list
    await expect(page.locator('[data-testid="file-item"]')).not.toBeVisible();
  });

  test('should handle bulk file operations', async ({ page }) => {
    // Navigate to files
    await page.click('[data-testid="files-nav-link"]');

    // Select multiple files
    await page.check('[data-testid="file-checkbox"]');
    await page.check('[data-testid="file-checkbox"]:nth-child(2)');

    // Verify bulk actions toolbar appears
    await expect(page.locator('[data-testid="bulk-actions-toolbar"]')).toBeVisible();

    // Test bulk download
    await page.click('[data-testid="bulk-download-button"]');
    
    // Test bulk star
    await page.click('[data-testid="bulk-star-button"]');
    await expect(page.locator('[data-testid="bulk-success-message"]')).toBeVisible();

    // Test bulk delete
    await page.click('[data-testid="bulk-delete-button"]');
    await expect(page.locator('[data-testid="bulk-delete-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-bulk-delete"]');
    
    // Verify files are deleted
    await expect(page.locator('[data-testid="bulk-delete-success"]')).toBeVisible();
  });

  test('should handle file sorting and pagination', async ({ page }) => {
    // Navigate to files
    await page.click('[data-testid="files-nav-link"]');

    // Test sorting by name
    await page.click('[data-testid="sort-by-name"]');
    await expect(page.locator('[data-testid="sort-indicator"]')).toBeVisible();

    // Test sorting by date
    await page.click('[data-testid="sort-by-date"]');
    
    // Test reverse sort
    await page.click('[data-testid="sort-by-date"]');
    await expect(page.locator('[data-testid="sort-order-desc"]')).toBeVisible();

    // Test pagination (if there are enough files)
    if (await page.locator('[data-testid="pagination-next"]').isVisible()) {
      await page.click('[data-testid="pagination-next"]');
      await expect(page.locator('[data-testid="page-indicator"]')).toContainText('2');
      
      await page.click('[data-testid="pagination-prev"]');
      await expect(page.locator('[data-testid="page-indicator"]')).toContainText('1');
    }
  });

  test('should handle file preview', async ({ page }) => {
    // Navigate to files
    await page.click('[data-testid="files-nav-link"]');

    // Click on a file to preview
    await page.click('[data-testid="file-item"] [data-testid="preview-button"]');

    // Wait for preview modal
    await expect(page.locator('[data-testid="file-preview-modal"]')).toBeVisible();

    // Verify preview content
    await expect(page.locator('[data-testid="preview-content"]')).toBeVisible();

    // Test preview navigation (if multiple files)
    if (await page.locator('[data-testid="preview-next"]').isVisible()) {
      await page.click('[data-testid="preview-next"]');
      await expect(page.locator('[data-testid="preview-content"]')).toBeVisible();
    }

    // Close preview
    await page.click('[data-testid="preview-close"]');
    await expect(page.locator('[data-testid="file-preview-modal"]')).not.toBeVisible();
  });

  test('should handle file comments', async ({ page }) => {
    // Navigate to files and open file details
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="file-item"]');

    // Navigate to comments section
    await page.click('[data-testid="comments-tab"]');

    // Add a comment
    await page.fill('[data-testid="comment-input"]', 'This is a test comment for E2E testing');
    await page.click('[data-testid="add-comment-button"]');

    // Verify comment appears
    await expect(page.locator('[data-testid="comment-item"]')).toContainText('This is a test comment for E2E testing');

    // Reply to comment
    await page.click('[data-testid="reply-button"]');
    await page.fill('[data-testid="reply-input"]', 'This is a reply to the comment');
    await page.click('[data-testid="submit-reply-button"]');

    // Verify reply appears
    await expect(page.locator('[data-testid="comment-reply"]')).toContainText('This is a reply to the comment');

    // Test comment reactions
    await page.click('[data-testid="comment-like-button"]');
    await expect(page.locator('[data-testid="like-count"]')).toContainText('1');
  });

  test('should handle file version history', async ({ page }) => {
    // Navigate to files and open file details
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="file-item"]');

    // Navigate to version history
    await page.click('[data-testid="versions-tab"]');

    // Verify current version is displayed
    await expect(page.locator('[data-testid="version-item"]')).toBeVisible();

    // Upload new version
    await page.click('[data-testid="upload-new-version-button"]');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-document-v2.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Updated PDF content'),
    });

    await page.click('[data-testid="upload-version-submit"]');

    // Verify new version appears
    await expect(page.locator('[data-testid="version-item"]')).toHaveCount(2);

    // Test version comparison
    await page.click('[data-testid="compare-versions-button"]');
    await expect(page.locator('[data-testid="version-comparison"]')).toBeVisible();

    // Test version restore
    await page.click('[data-testid="restore-version-button"]');
    await page.click('[data-testid="confirm-restore"]');
    await expect(page.locator('[data-testid="restore-success-message"]')).toBeVisible();
  });

  test('should handle offline functionality', async ({ page, context }) => {
    // Navigate to files
    await page.click('[data-testid="files-nav-link"]');

    // Go offline
    await context.setOffline(true);

    // Try to upload a file while offline
    await page.click('[data-testid="upload-file-button"]');
    await expect(page.locator('[data-testid="offline-message"]')).toBeVisible();

    // Verify offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Go back online
    await context.setOffline(false);
    await page.reload();

    // Verify online functionality is restored
    await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
  });

  test('should handle file accessibility features', async ({ page }) => {
    // Navigate to files
    await page.click('[data-testid="files-nav-link"]');

    // Test keyboard navigation
    await page.press('[data-testid="file-list"]', 'Tab');
    await expect(page.locator('[data-testid="file-item"]:focus')).toBeVisible();

    // Test screen reader labels
    const fileItem = page.locator('[data-testid="file-item"]').first();
    await expect(fileItem).toHaveAttribute('aria-label');

    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveClass(/dark-theme/);

    // Test keyboard shortcuts
    await page.press('body', 'Control+k');
    await expect(page.locator('[data-testid="quick-actions-modal"]')).toBeVisible();
  });
});