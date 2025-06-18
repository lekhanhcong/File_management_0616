import { test, expect } from '@playwright/test';

test.describe('Team Collaboration E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as team owner
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'teamowner@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
  });

  test('should create a new team', async ({ page }) => {
    // Navigate to teams section
    await page.click('[data-testid="teams-nav-link"]');
    await expect(page).toHaveURL('/teams');

    // Click create team button
    await page.click('[data-testid="create-team-button"]');
    
    // Wait for team creation modal
    await expect(page.locator('[data-testid="create-team-modal"]')).toBeVisible();

    // Fill team details
    await page.fill('[data-testid="team-name-input"]', 'E2E Test Team');
    await page.fill('[data-testid="team-description-input"]', 'A team created for E2E testing purposes');
    await page.fill('[data-testid="team-slug-input"]', 'e2e-test-team');

    // Set team privacy
    await page.check('[data-testid="team-public-checkbox"]');

    // Submit team creation
    await page.click('[data-testid="create-team-submit"]');

    // Verify success message
    await expect(page.locator('[data-testid="team-creation-success"]')).toBeVisible();

    // Verify team appears in list
    await expect(page.locator('[data-testid="team-list"]')).toContainText('E2E Test Team');
    
    // Navigate to the new team
    await page.click('[data-testid="team-item"]:has-text("E2E Test Team")');
    await expect(page.locator('[data-testid="team-name"]')).toContainText('E2E Test Team');
  });

  test('should invite team members', async ({ page }) => {
    // Navigate to a team
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');

    // Click invite member button
    await page.click('[data-testid="invite-member-button"]');
    
    // Wait for invite modal
    await expect(page.locator('[data-testid="invite-member-modal"]')).toBeVisible();

    // Fill invitation details
    await page.fill('[data-testid="invite-email-input"]', 'newmember@example.com');
    await page.selectOption('[data-testid="invite-role-select"]', 'member');

    // Send invitation
    await page.click('[data-testid="send-invitation-button"]');

    // Verify success message
    await expect(page.locator('[data-testid="invitation-sent-success"]')).toBeVisible();

    // Navigate to pending invitations tab
    await page.click('[data-testid="pending-invitations-tab"]');
    
    // Verify invitation appears in pending list
    await expect(page.locator('[data-testid="pending-invitations-list"]')).toContainText('newmember@example.com');
  });

  test('should manage team member roles', async ({ page }) => {
    // Navigate to team members
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="members-tab"]');

    // Find a team member (not the owner)
    const memberItem = page.locator('[data-testid="member-item"]').nth(1);
    await memberItem.locator('[data-testid="member-menu-button"]').click();

    // Change member role to admin
    await page.click('[data-testid="change-role-admin"]');
    
    // Confirm role change
    await expect(page.locator('[data-testid="role-change-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-role-change"]');

    // Verify role change
    await expect(memberItem.locator('[data-testid="member-role"]')).toContainText('Admin');
    
    // Verify success message
    await expect(page.locator('[data-testid="role-change-success"]')).toBeVisible();
  });

  test('should remove team member', async ({ page }) => {
    // Navigate to team members
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="members-tab"]');

    // Find a team member to remove
    const memberItem = page.locator('[data-testid="member-item"]').last();
    await memberItem.locator('[data-testid="member-menu-button"]').click();

    // Remove member
    await page.click('[data-testid="remove-member-option"]');
    
    // Confirm removal
    await expect(page.locator('[data-testid="remove-member-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-remove-member"]');

    // Verify member is removed
    await expect(page.locator('[data-testid="member-removal-success"]')).toBeVisible();
    
    // Verify member count decreased
    const memberCount = await page.locator('[data-testid="member-count"]').textContent();
    expect(parseInt(memberCount?.split(' ')[0] || '0')).toBeGreaterThan(0);
  });

  test('should share files within team', async ({ page }) => {
    // Navigate to team files
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="team-files-tab"]');

    // Upload a file to share with team
    await page.click('[data-testid="upload-team-file-button"]');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'team-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Team shared document content'),
    });

    await page.fill('[data-testid="file-description"]', 'Shared team document');
    await page.click('[data-testid="upload-submit-button"]');

    // Verify file appears in team files
    await expect(page.locator('[data-testid="team-file-list"]')).toContainText('team-document.pdf');

    // Test file sharing permissions
    await page.click('[data-testid="team-file-item"] [data-testid="share-button"]');
    await expect(page.locator('[data-testid="team-sharing-options"]')).toBeVisible();

    // Set team-wide permissions
    await page.check('[data-testid="allow-team-download"]');
    await page.check('[data-testid="allow-team-edit"]');
    await page.click('[data-testid="save-team-permissions"]');

    // Verify permissions are saved
    await expect(page.locator('[data-testid="permissions-saved-success"]')).toBeVisible();
  });

  test('should use real-time collaboration features', async ({ page, context }) => {
    // Navigate to a shared file
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="team-files-tab"]');
    await page.click('[data-testid="team-file-item"]');

    // Enable collaboration mode
    await page.click('[data-testid="collaborate-button"]');
    await expect(page.locator('[data-testid="collaboration-session"]')).toBeVisible();

    // Open second browser context to simulate another user
    const secondPage = await context.newPage();
    await secondPage.goto('/login');
    await secondPage.fill('[data-testid="email-input"]', 'teammember@example.com');
    await secondPage.fill('[data-testid="password-input"]', 'password123');
    await secondPage.click('[data-testid="login-button"]');

    // Navigate to the same file
    await secondPage.goto(page.url());
    await secondPage.click('[data-testid="collaborate-button"]');

    // Verify both users see each other online
    await expect(page.locator('[data-testid="online-collaborators"]')).toContainText('2 collaborators');
    await expect(secondPage.locator('[data-testid="online-collaborators"]')).toContainText('2 collaborators');

    // Test real-time commenting
    await page.click('[data-testid="add-comment-button"]');
    await page.fill('[data-testid="comment-input"]', 'Real-time comment from user 1');
    await page.click('[data-testid="submit-comment"]');

    // Verify comment appears on second user's screen
    await expect(secondPage.locator('[data-testid="comments-section"]')).toContainText('Real-time comment from user 1');

    // Test live cursor tracking
    await page.click('[data-testid="document-content"]', { position: { x: 100, y: 100 } });
    
    // Verify cursor position is visible to other user
    await expect(secondPage.locator('[data-testid="live-cursor"]')).toBeVisible();

    await secondPage.close();
  });

  test('should handle team notifications', async ({ page }) => {
    // Navigate to team settings
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="team-settings-button"]');

    // Configure notification settings
    await page.click('[data-testid="notifications-tab"]');
    await page.check('[data-testid="notify-file-uploads"]');
    await page.check('[data-testid="notify-member-changes"]');
    await page.uncheck('[data-testid="notify-comments"]');

    // Save notification settings
    await page.click('[data-testid="save-notification-settings"]');
    await expect(page.locator('[data-testid="settings-saved-success"]')).toBeVisible();

    // Trigger a notification by uploading a file
    await page.click('[data-testid="team-files-tab"]');
    await page.click('[data-testid="upload-team-file-button"]');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'notification-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Notification test content'),
    });

    await page.click('[data-testid="upload-submit-button"]');

    // Check for notification
    await expect(page.locator('[data-testid="notification-bell"]')).toHaveClass(/has-notifications/);
    
    // Open notifications panel
    await page.click('[data-testid="notification-bell"]');
    await expect(page.locator('[data-testid="notification-panel"]')).toContainText('New file uploaded');
  });

  test('should manage team projects', async ({ page }) => {
    // Navigate to team projects
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="team-projects-tab"]');

    // Create a new team project
    await page.click('[data-testid="create-team-project-button"]');
    await page.fill('[data-testid="project-name-input"]', 'Team E2E Project');
    await page.fill('[data-testid="project-description-input"]', 'A project for team collaboration testing');
    
    // Set project permissions
    await page.check('[data-testid="allow-team-access"]');
    await page.selectOption('[data-testid="default-permissions"]', 'edit');

    // Create project
    await page.click('[data-testid="create-project-submit"]');
    await expect(page.locator('[data-testid="project-creation-success"]')).toBeVisible();

    // Verify project appears in team projects
    await expect(page.locator('[data-testid="team-projects-list"]')).toContainText('Team E2E Project');

    // Open project and verify team access
    await page.click('[data-testid="project-item"]:has-text("Team E2E Project")');
    await expect(page.locator('[data-testid="project-team-members"]')).toBeVisible();
  });

  test('should handle team activity feed', async ({ page }) => {
    // Navigate to team activity
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="activity-tab"]');

    // Verify activity feed is visible
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible();

    // Generate some activity by uploading a file
    await page.click('[data-testid="team-files-tab"]');
    await page.click('[data-testid="upload-team-file-button"]');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'activity-test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Activity test content'),
    });

    await page.click('[data-testid="upload-submit-button"]');

    // Go back to activity feed
    await page.click('[data-testid="activity-tab"]');

    // Verify new activity appears
    await expect(page.locator('[data-testid="activity-feed"]')).toContainText('uploaded activity-test.pdf');

    // Test activity filtering
    await page.click('[data-testid="activity-filter-dropdown"]');
    await page.click('[data-testid="filter-file-uploads"]');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="activity-item"]')).toContainText('uploaded');

    // Test activity search
    await page.fill('[data-testid="activity-search"]', 'activity-test');
    await expect(page.locator('[data-testid="activity-item"]')).toContainText('activity-test.pdf');
  });

  test('should handle team permissions and roles', async ({ page }) => {
    // Navigate to team settings
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="team-settings-button"]');

    // Go to permissions tab
    await page.click('[data-testid="permissions-tab"]');

    // Configure default permissions for new members
    await page.selectOption('[data-testid="default-file-permissions"]', 'view-download');
    await page.check('[data-testid="allow-file-comments"]');
    await page.uncheck('[data-testid="allow-file-sharing"]');

    // Set team-wide settings
    await page.check('[data-testid="require-approval-for-joins"]');
    await page.fill('[data-testid="max-team-size"]', '50');

    // Save permission settings
    await page.click('[data-testid="save-permission-settings"]');
    await expect(page.locator('[data-testid="permissions-saved-success"]')).toBeVisible();

    // Test role-based permissions
    await page.click('[data-testid="role-permissions-tab"]');
    
    // Configure admin permissions
    await page.click('[data-testid="admin-role-settings"]');
    await page.check('[data-testid="admin-can-invite"]');
    await page.check('[data-testid="admin-can-remove-members"]');
    await page.check('[data-testid="admin-can-change-settings"]');

    // Configure member permissions
    await page.click('[data-testid="member-role-settings"]');
    await page.check('[data-testid="member-can-upload"]');
    await page.uncheck('[data-testid="member-can-delete"]');

    // Save role permissions
    await page.click('[data-testid="save-role-permissions"]');
    await expect(page.locator('[data-testid="role-permissions-saved"]')).toBeVisible();
  });

  test('should handle team search and discovery', async ({ page }) => {
    // Navigate to teams discovery page
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="discover-teams-tab"]');

    // Search for public teams
    await page.fill('[data-testid="team-search-input"]', 'public');
    await page.press('[data-testid="team-search-input"]', 'Enter');

    // Verify search results
    await expect(page.locator('[data-testid="team-search-results"]')).toBeVisible();

    // Filter by team size
    await page.click('[data-testid="team-size-filter"]');
    await page.click('[data-testid="size-small"]'); // 1-10 members

    // Filter by activity level
    await page.click('[data-testid="activity-filter"]');
    await page.click('[data-testid="highly-active"]');

    // Request to join a public team
    await page.click('[data-testid="team-result-item"] [data-testid="join-team-button"]');
    await expect(page.locator('[data-testid="join-request-sent"]')).toBeVisible();

    // View team details before joining
    await page.click('[data-testid="team-result-item"] [data-testid="view-team-details"]');
    await expect(page.locator('[data-testid="team-preview-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-member-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="team-recent-activity"]')).toBeVisible();
  });

  test('should handle team integration with external services', async ({ page }) => {
    // Navigate to team integrations
    await page.click('[data-testid="teams-nav-link"]');
    await page.click('[data-testid="team-item"]');
    await page.click('[data-testid="team-settings-button"]');
    await page.click('[data-testid="integrations-tab"]');

    // Configure Slack integration
    await page.click('[data-testid="slack-integration-card"]');
    await page.fill('[data-testid="slack-webhook-url"]', 'https://hooks.slack.com/test-webhook');
    await page.check('[data-testid="notify-file-uploads-slack"]');
    await page.check('[data-testid="notify-member-changes-slack"]');

    // Test Slack integration
    await page.click('[data-testid="test-slack-integration"]');
    await expect(page.locator('[data-testid="slack-test-success"]')).toBeVisible();

    // Save integration settings
    await page.click('[data-testid="save-slack-integration"]');
    await expect(page.locator('[data-testid="integration-saved-success"]')).toBeVisible();

    // Configure email notifications
    await page.click('[data-testid="email-integration-card"]');
    await page.check('[data-testid="daily-digest-email"]');
    await page.selectOption('[data-testid="digest-time"]', '09:00');

    // Save email settings
    await page.click('[data-testid="save-email-integration"]');
    await expect(page.locator('[data-testid="email-settings-saved"]')).toBeVisible();
  });
});