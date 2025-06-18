// Comprehensive verification test for FileFlowMaster
const http = require('http');
const fs = require('fs');
const path = require('path');

async function verifyApp() {
  console.log('🔍 FileFlowMaster - Comprehensive Verification Test');
  console.log('================================================\n');

  let allTestsPassed = true;

  // Test 1: Server Health Check
  console.log('✅ Test 1: Server Health Check');
  try {
    const result = await testEndpoint('/', 'GET');
    if (result.status === 200) {
      console.log('  ✓ Server is running on http://localhost:3001');
      console.log('  ✓ Homepage responds with status 200');
    } else {
      console.log('  ❌ Server health check failed');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ❌ Server is not running or not accessible');
    allTestsPassed = false;
  }

  // Test 2: API Endpoints
  console.log('\n✅ Test 2: API Endpoints');
  try {
    const filesResult = await testEndpoint('/api/files', 'GET');
    if (filesResult.status === 200) {
      const data = JSON.parse(filesResult.data);
      console.log('  ✓ /api/files endpoint working');
      console.log('  ✓ Response structure:', {
        files: Array.isArray(data.files),
        total: typeof data.total === 'number',
        page: typeof data.page === 'number'
      });
    } else {
      console.log('  ❌ Files API endpoint failed');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log('  ❌ API endpoints test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 3: File Structure
  console.log('\n✅ Test 3: File Structure');
  const criticalFiles = [
    'package.json',
    'server/index.ts',
    'client/src/App.tsx',
    'shared/schema.ts',
    'server/db.ts'
  ];

  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      console.log(`  ✓ ${file} exists`);
    } else {
      console.log(`  ❌ ${file} missing`);
      allTestsPassed = false;
    }
  }

  // Test 4: Build Status
  console.log('\n✅ Test 4: Build Status');
  if (fs.existsSync('dist')) {
    console.log('  ✓ Build artifacts exist in dist/ directory');
  } else {
    console.log('  ⚠️ No build artifacts found (run npm run build)');
  }

  // Test 5: Database Connection
  console.log('\n✅ Test 5: Database');
  if (fs.existsSync('dev.db')) {
    console.log('  ✓ Database file exists (dev.db)');
  } else {
    console.log('  ⚠️ Database file not found');
  }

  // Final Results
  console.log('\n================================================');
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ FileFlowMaster is working correctly');
    console.log('🚀 Application is ready for use');
  } else {
    console.log('⚠️ SOME TESTS FAILED');
    console.log('❌ Please check the issues above');
  }
  console.log('================================================');

  return allTestsPassed;
}

function testEndpoint(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.setTimeout(5000);
    req.end();
  });
}

verifyApp().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});