// Global setup for Playwright tests
// Handles test environment preparation

import fs from 'fs';
import path from 'path';

async function globalSetup(config) {
  console.log('🚀 Starting global test setup...');
  
  // Create necessary test directories
  const testDirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/html-report',
    'tests/fixtures',
    'tests/temp'
  ];
  
  for (const dir of testDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
  
  // Create test fixtures
  const fixtures = [
    {
      path: 'tests/fixtures/test-document.txt',
      content: 'This is a test document for FileFlowMaster E2E testing.\n\nIt contains sample content for upload testing.'
    },
    {
      path: 'tests/fixtures/test-image.txt',
      content: 'Mock image file content for testing image uploads.'
    },
    {
      path: 'tests/fixtures/large-file.txt',
      content: 'Large file content for testing file size limits.\n'.repeat(1000)
    }
  ];
  
  for (const fixture of fixtures) {
    const fixturePath = path.join(process.cwd(), fixture.path);
    if (!fs.existsSync(fixturePath)) {
      fs.writeFileSync(fixturePath, fixture.content);
      console.log(`📄 Created test fixture: ${fixture.path}`);
    }
  }
  
  // Setup test database or other environment variables if needed
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  
  // Verify server dependencies
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`📦 Testing ${packageJson.name} v${packageJson.version}`);
  } catch (error) {
    console.warn('⚠️ Could not read package.json');
  }
  
  console.log('✅ Global setup completed successfully!');
}

export default globalSetup;