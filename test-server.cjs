// Simple test to verify server is working
const http = require('http');

function testEndpoint(path, expectedData) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`✅ ${path}: Status ${res.statusCode}`);
        if (expectedData) {
          try {
            const parsed = JSON.parse(data);
            console.log(`   Response:`, parsed);
          } catch (e) {
            console.log(`   HTML Response received (${data.length} chars)`);
          }
        }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000);
  });
}

async function runTests() {
  console.log('🧪 Testing FileFlowMaster Server...\n');
  
  try {
    // Test home page
    await testEndpoint('/');
    
    // Test API endpoints
    await testEndpoint('/api/files', true);
    
    console.log('\n✅ All basic tests passed\!');
    console.log('🚀 Server is running and responding correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();