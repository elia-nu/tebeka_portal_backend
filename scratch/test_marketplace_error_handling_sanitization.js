const http = require('http');

function makeRequest(port, path) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: `/api/v1${path}`,
      method: 'GET'
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: rawData });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.end();
  });
}

async function testMarketplaceErrors() {
  console.log('=== Starting Marketplace & Discovery Error Handling Verification ===\n');

  console.log('--- Test 1: Query Nonexistent Attorney on Port 3001 ---');
  const res3001 = await makeRequest(3001, '/discovery/attorneys/nonexistent-id');
  console.log('Response (Port 3001):', JSON.stringify(res3001, null, 2));
  if (res3001.status === 404 && res3001.data?.error) {
    console.log('[PASS] Sanitized 404 error returned cleanly.\n');
  }

  console.log('--- Test 2: Validation Error on Search / Discovery ---');
  const resBadQuery = await makeRequest(3001, '/discovery/attorneys?limit=-5');
  console.log('Response for invalid limit:', JSON.stringify(resBadQuery, null, 2));

  console.log('=== ALL MARKETPLACE / DISCOVERY SANITIZATION TESTS COMPLETED! ===');
}

testMarketplaceErrors().catch(console.error);
