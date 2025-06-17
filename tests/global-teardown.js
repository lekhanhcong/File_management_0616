// Global teardown for Playwright tests
// Handles cleanup after all tests complete

import fs from 'fs';
import path from 'path';

async function globalTeardown(config) {
  console.log('🧹 Starting global test teardown...');
  
  // Clean up temporary test files
  const tempDirs = [
    'tests/temp',
    'uploads/temp'
  ];
  
  for (const dir of tempDirs) {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`🗑️ Cleaned up directory: ${dir}`);
      } catch (error) {
        console.warn(`⚠️ Could not clean up ${dir}:`, error.message);
      }
    }
  }
  
  // Clean up test fixtures (optional - you might want to keep them)
  const shouldCleanFixtures = process.env.CLEAN_FIXTURES === 'true';
  if (shouldCleanFixtures) {
    const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
    if (fs.existsSync(fixturesDir)) {
      try {
        fs.rmSync(fixturesDir, { recursive: true, force: true });
        console.log('🗑️ Cleaned up test fixtures');
      } catch (error) {
        console.warn('⚠️ Could not clean up fixtures:', error.message);
      }
    }
  }
  
  // Generate test summary
  try {
    const resultsPath = path.join(process.cwd(), 'test-results', 'test-results.json');
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      
      console.log('\n📊 Test Summary:');
      console.log(`Total tests: ${results.stats?.total || 'Unknown'}`);
      console.log(`Passed: ${results.stats?.passed || 'Unknown'}`);
      console.log(`Failed: ${results.stats?.failed || 'Unknown'}`);
      console.log(`Skipped: ${results.stats?.skipped || 'Unknown'}`);
      
      if (results.stats?.duration) {
        console.log(`Duration: ${(results.stats.duration / 1000).toFixed(2)}s`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not generate test summary:', error.message);
  }
  
  // Reset environment variables
  delete process.env.TEST_MODE;
  
  console.log('✅ Global teardown completed successfully!');
}

export default globalTeardown;