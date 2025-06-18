import { test, expect } from '@playwright/test';

test.describe('Advanced Search Functionality E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login and setup test data
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL('/dashboard');
  });

  test('should perform basic search', async ({ page }) => {
    // Navigate to files page
    await page.click('[data-testid="files-nav-link"]');
    
    // Perform basic search
    await page.fill('[data-testid="search-input"]', 'document');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Verify search results
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-results-count"]')).toContainText('results for "document"');
    
    // Verify search highlighting
    await expect(page.locator('[data-testid="search-highlight"]')).toBeVisible();
  });

  test('should use advanced search filters', async ({ page }) => {
    // Open advanced search
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="advanced-search-button"]');
    
    // Wait for advanced search modal
    await expect(page.locator('[data-testid="advanced-search-modal"]')).toBeVisible();
    
    // Set file type filter
    await page.click('[data-testid="file-type-filter"]');
    await page.check('[data-testid="file-type-pdf"]');
    await page.check('[data-testid="file-type-image"]');
    
    // Set date range filter
    await page.click('[data-testid="date-range-filter"]');
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-12-31');
    
    // Set size filter
    await page.fill('[data-testid="size-min"]', '1');
    await page.fill('[data-testid="size-max"]', '10');
    
    // Set tags filter
    await page.fill('[data-testid="tags-filter"]', 'important');
    
    // Apply filters
    await page.click('[data-testid="apply-filters-button"]');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="active-filters"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-badge-pdf"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-badge-important"]')).toBeVisible();
  });

  test('should save and load search queries', async ({ page }) => {
    // Perform a search with filters
    await page.click('[data-testid="files-nav-link"]');
    await page.fill('[data-testid="search-input"]', 'project documents');
    await page.click('[data-testid="advanced-search-button"]');
    
    // Set some filters
    await page.check('[data-testid="file-type-pdf"]');
    await page.fill('[data-testid="tags-filter"]', 'work');
    await page.click('[data-testid="apply-filters-button"]');
    
    // Save the search
    await page.click('[data-testid="save-search-button"]');
    await page.fill('[data-testid="search-name-input"]', 'Work Documents Search');
    await page.click('[data-testid="confirm-save-search"]');
    
    // Verify search is saved
    await expect(page.locator('[data-testid="search-saved-message"]')).toBeVisible();
    
    // Clear search and load saved search
    await page.click('[data-testid="clear-search-button"]');
    await page.click('[data-testid="saved-searches-dropdown"]');
    await page.click('[data-testid="saved-search-item"]:has-text("Work Documents Search")');
    
    // Verify saved search is loaded
    await expect(page.locator('[data-testid="search-input"]')).toHaveValue('project documents');
    await expect(page.locator('[data-testid="filter-badge-pdf"]')).toBeVisible();
    await expect(page.locator('[data-testid="filter-badge-work"]')).toBeVisible();
  });

  test('should provide search suggestions', async ({ page }) => {
    // Navigate to search
    await page.click('[data-testid="files-nav-link"]');
    
    // Start typing to trigger suggestions
    await page.fill('[data-testid="search-input"]', 'doc');
    
    // Wait for suggestions to appear
    await expect(page.locator('[data-testid="search-suggestions"]')).toBeVisible();
    
    // Verify suggestion types
    await expect(page.locator('[data-testid="suggestion-recent"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-popular"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestion-autocomplete"]')).toBeVisible();
    
    // Click on a suggestion
    await page.click('[data-testid="suggestion-item"]');
    
    // Verify suggestion is applied
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should handle search within teams', async ({ page }) => {
    // Navigate to teams
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    
    // Use team-specific search
    await page.fill('[data-testid="team-search-input"]', 'shared documents');
    await page.press('[data-testid="team-search-input"]', 'Enter');
    
    // Verify team search results
    await expect(page.locator('[data-testid="team-search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-context-indicator"]')).toContainText('within team');
    
    // Test team member filter
    await page.click('[data-testid="team-member-filter"]');
    await page.check('[data-testid="member-john-doe"]');
    
    // Verify filtered by team member
    await expect(page.locator('[data-testid="member-filter-badge"]')).toContainText('John Doe');
  });

  test('should handle global search across all content', async ({ page }) => {
    // Use global search shortcut
    await page.press('body', 'Control+k');
    
    // Wait for global search modal
    await expect(page.locator('[data-testid="global-search-modal"]')).toBeVisible();
    
    // Search across all content types
    await page.fill('[data-testid="global-search-input"]', 'quarterly report');
    
    // Verify results from different content types
    await expect(page.locator('[data-testid="search-category-files"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-category-projects"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-category-teams"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-category-users"]')).toBeVisible();
    
    // Navigate to a specific result
    await page.click('[data-testid="search-result-item"]');
    
    // Verify navigation to the correct item
    await expect(page.locator('[data-testid="item-details"]')).toBeVisible();
  });

  test('should handle search sorting and relevance', async ({ page }) => {
    // Perform search
    await page.click('[data-testid="files-nav-link"]');
    await page.fill('[data-testid="search-input"]', 'presentation');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Test relevance sorting (default)
    await expect(page.locator('[data-testid="sort-relevance"]')).toHaveClass(/active/);
    
    // Change to date sorting
    await page.click('[data-testid="sort-date"]');
    await expect(page.locator('[data-testid="sort-date"]')).toHaveClass(/active/);
    
    // Verify results are reordered
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Test reverse sort
    await page.click('[data-testid="sort-order-toggle"]');
    await expect(page.locator('[data-testid="sort-order-desc"]')).toBeVisible();
    
    // Test name sorting
    await page.click('[data-testid="sort-name"]');
    await expect(page.locator('[data-testid="sort-name"]')).toHaveClass(/active/);
    
    // Test size sorting
    await page.click('[data-testid="sort-size"]');
    await expect(page.locator('[data-testid="sort-size"]')).toHaveClass(/active/);
  });

  test('should handle search with boolean operators', async ({ page }) => {
    // Navigate to advanced search
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="advanced-search-button"]');
    
    // Test AND operator
    await page.fill('[data-testid="search-input"]', 'document AND report');
    await page.click('[data-testid="apply-search"]');
    
    // Verify AND results
    await expect(page.locator('[data-testid="search-operator-info"]')).toContainText('AND');
    
    // Test OR operator
    await page.fill('[data-testid="search-input"]', 'presentation OR slides');
    await page.click('[data-testid="apply-search"]');
    
    // Verify OR results
    await expect(page.locator('[data-testid="search-operator-info"]')).toContainText('OR');
    
    // Test NOT operator
    await page.fill('[data-testid="search-input"]', 'document NOT draft');
    await page.click('[data-testid="apply-search"]');
    
    // Verify NOT results
    await expect(page.locator('[data-testid="search-operator-info"]')).toContainText('NOT');
    
    // Test quoted phrases
    await page.fill('[data-testid="search-input"]', '"quarterly financial report"');
    await page.click('[data-testid="apply-search"]');
    
    // Verify exact phrase search
    await expect(page.locator('[data-testid="search-phrase-info"]')).toContainText('exact phrase');
  });

  test('should handle search within file content', async ({ page }) => {
    // Enable content search
    await page.click('[data-testid="files-nav-link"]');
    await page.click('[data-testid="advanced-search-button"]');
    await page.check('[data-testid="search-file-content"]');
    
    // Search for content within files
    await page.fill('[data-testid="search-input"]', 'budget analysis');
    await page.click('[data-testid="apply-search"]');
    
    // Verify content search results
    await expect(page.locator('[data-testid="content-search-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="content-highlight"]')).toBeVisible();
    
    // Test content preview
    await page.click('[data-testid="content-preview-button"]');
    await expect(page.locator('[data-testid="content-preview-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="highlighted-content"]')).toBeVisible();
  });

  test('should handle search performance and pagination', async ({ page }) => {
    // Perform a broad search that returns many results
    await page.click('[data-testid="files-nav-link"]');
    await page.fill('[data-testid="search-input"]', 'file');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Wait for search to complete
    await expect(page.locator('[data-testid="search-loading"]')).not.toBeVisible();
    
    // Verify performance indicators
    await expect(page.locator('[data-testid="search-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="results-count"]')).toBeVisible();
    
    // Test pagination of search results
    if (await page.locator('[data-testid="search-pagination"]').isVisible()) {
      await page.click('[data-testid="search-next-page"]');
      await expect(page.locator('[data-testid="search-page-2"]')).toBeVisible();
      
      // Test page size options
      await page.click('[data-testid="results-per-page"]');
      await page.click('[data-testid="results-50"]');
      
      // Verify page size change
      await expect(page.locator('[data-testid="results-per-page-indicator"]')).toContainText('50');
    }
  });

  test('should handle search analytics and insights', async ({ page }) => {
    // Navigate to search analytics (admin feature)
    await page.click('[data-testid="admin-nav-link"]');
    await page.click('[data-testid="search-analytics-link"]');
    
    // Verify search analytics dashboard
    await expect(page.locator('[data-testid="search-analytics-dashboard"]')).toBeVisible();
    
    // Test popular search terms
    await expect(page.locator('[data-testid="popular-searches"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-trends"]')).toBeVisible();
    
    // Test search performance metrics
    await expect(page.locator('[data-testid="avg-search-time"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-success-rate"]')).toBeVisible();
    
    // Test no-results queries
    await expect(page.locator('[data-testid="no-results-queries"]')).toBeVisible();
    
    // Test search volume over time
    await expect(page.locator('[data-testid="search-volume-chart"]')).toBeVisible();
  });

  test('should handle search with accessibility features', async ({ page }) => {
    // Test keyboard navigation in search
    await page.click('[data-testid="files-nav-link"]');
    await page.press('[data-testid="search-input"]', 'Tab');
    
    // Use keyboard to navigate search suggestions
    await page.fill('[data-testid="search-input"]', 'doc');
    await page.press('[data-testid="search-input"]', 'ArrowDown');
    await page.press('[data-testid="search-input"]', 'ArrowDown');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Verify keyboard navigation works
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Test screen reader announcements
    await expect(page.locator('[data-testid="search-results"]')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('[data-testid="results-count"]')).toHaveAttribute('aria-label');
    
    // Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    
    // Test focus management
    await page.press('body', 'Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('should handle search error states', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/search**', route => route.abort());
    
    // Attempt search
    await page.click('[data-testid="files-nav-link"]');
    await page.fill('[data-testid="search-input"]', 'test');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Verify error handling
    await expect(page.locator('[data-testid="search-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-retry-button"]')).toBeVisible();
    
    // Test retry functionality
    await page.unroute('**/api/search**');
    await page.click('[data-testid="search-retry-button"]');
    
    // Verify search works after retry
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });

  test('should handle search with special characters and internationalization', async ({ page }) => {
    // Test search with special characters
    await page.click('[data-testid="files-nav-link"]');
    await page.fill('[data-testid="search-input"]', 'café & résumé');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Verify special characters are handled
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Test Unicode characters
    await page.fill('[data-testid="search-input"]', '测试文档');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Verify Unicode search works
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
    
    // Test emoji search
    await page.fill('[data-testid="search-input"]', '📄 document');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Verify emoji search works
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  });
});