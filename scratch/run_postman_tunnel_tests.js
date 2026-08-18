const fs = require('fs');
const axios = require('axios');

const collection = JSON.parse(fs.readFileSync('Tebeka_User_Service_Postman_Collection.json', 'utf8'));
const environment = JSON.parse(fs.readFileSync('scratch/tunnel_environment.json', 'utf8'));

// Build environment variable map
const envMap = {};
environment.values.forEach(item => {
  envMap[item.key] = item.value || '';
});

// Helper to resolve {{variable}} in strings/objects
function resolveVariables(target) {
  if (typeof target === 'string') {
    return target.replace(/\{\{([^}]+)\}\}/g, (_, key) => envMap[key] || `{{${key}}}`);
  }
  if (Array.isArray(target)) {
    return target.map(resolveVariables);
  }
  if (typeof target === 'object' && target !== null) {
    const resolved = {};
    for (const k in target) {
      resolved[k] = resolveVariables(target[k]);
    }
    return resolved;
  }
  return target;
}

function extractRequests(items, folderPath = '') {
  let requests = [];
  for (const item of items) {
    const currentPath = folderPath ? `${folderPath} > ${item.name}` : item.name;
    if (item.item) {
      requests = requests.concat(extractRequests(item.item, currentPath));
    } else if (item.request) {
      requests.push({
        id: item.id || item.name,
        folder: folderPath,
        name: item.name,
        request: item.request
      });
    }
  }
  return requests;
}

const allRequests = extractRequests(collection.item || []);

async function executeTestRun() {
  console.log(`=== STARTING POSTMAN COLLECTION TEST OVER CLOUDFLARE TUNNEL ===`);
  console.log(`Tunnel URL: ${envMap.baseUrl}`);
  console.log(`Total Endpoints in Collection: ${allRequests.length}\n`);

  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < allRequests.length; i++) {
    const reqItem = allRequests[i];
    const rawUrl = typeof reqItem.request.url === 'string' ? reqItem.request.url : (reqItem.request.url.raw || '');
    const resolvedUrl = resolveVariables(rawUrl);
    const method = reqItem.request.method || 'GET';

    // Parse headers
    const headers = {
      'User-Agent': 'Postman-Cloudflare-Tunnel-Test-Runner/1.0',
      'Content-Type': 'application/json'
    };
    if (reqItem.request.header && Array.isArray(reqItem.request.header)) {
      reqItem.request.header.forEach(h => {
        if (h.key && h.value && !h.disabled) {
          headers[h.key] = resolveVariables(h.value);
        }
      });
    }

    // Handle Auth header if defined on request
    if (reqItem.request.auth && reqItem.request.auth.type === 'bearer') {
      const bearer = reqItem.request.auth.bearer;
      if (Array.isArray(bearer)) {
        const tokenObj = bearer.find(b => b.key === 'token');
        if (tokenObj) {
          const resolvedToken = resolveVariables(tokenObj.value);
          if (resolvedToken && !resolvedToken.startsWith('{{')) {
            headers['Authorization'] = `Bearer ${resolvedToken}`;
          }
        }
      }
    }

    // Parse body if present
    let body = undefined;
    if (reqItem.request.body && reqItem.request.body.mode === 'raw') {
      try {
        const rawBody = resolveVariables(reqItem.request.body.raw);
        body = JSON.parse(rawBody);
      } catch (e) {
        body = resolveVariables(reqItem.request.body.raw);
      }
    }

    const startTime = Date.now();
    try {
      const res = await axios({
        method: method,
        url: resolvedUrl,
        headers: headers,
        data: body,
        timeout: 8000,
        validateStatus: () => true // Allow any status code to inspect response
      });

      const duration = Date.now() - startTime;
      const isSuccess = res.status >= 200 && res.status < 400;
      if (isSuccess) passedCount++; else failedCount++;

      // Store tokens if returned in auth calls
      if (res.data && res.data.data) {
        if (res.data.data.accessToken) {
          envMap['clientAuthToken'] = res.data.data.accessToken;
          envMap['attorneyAuthToken'] = res.data.data.accessToken;
          envMap['adminAuthToken'] = res.data.data.accessToken;
        }
        if (res.data.data.token) {
          envMap['otpContinuationToken'] = res.data.data.token;
        }
        if (res.data.data.id) {
          if (reqItem.name.includes('Attorney')) envMap['attorneyProfileId'] = res.data.data.id;
          else envMap['userId'] = res.data.data.id;
        }
      }

      results.push({
        num: i + 1,
        name: reqItem.name,
        method: method,
        url: resolvedUrl,
        status: res.status,
        durationMs: duration,
        passed: isSuccess,
        responseSnippet: JSON.stringify(res.data).substring(0, 120)
      });

      console.log(`[${i + 1}/${allRequests.length}] ${method} ${resolvedUrl} -> Status: ${res.status} (${duration}ms)`);

    } catch (err) {
      const duration = Date.now() - startTime;
      failedCount++;
      results.push({
        num: i + 1,
        name: reqItem.name,
        method: method,
        url: resolvedUrl,
        status: 'ERROR',
        durationMs: duration,
        passed: false,
        error: err.message
      });
      console.log(`[${i + 1}/${allRequests.length}] ${method} ${resolvedUrl} -> ERROR: ${err.message} (${duration}ms)`);
    }
  }

  console.log(`\n=== SUMMARY OF CLOUDFLARE TUNNEL ENDPOINT TEST RUN ===`);
  console.log(`Total Requests Executed: ${allRequests.length}`);
  console.log(`Passed (2xx/3xx): ${passedCount}`);
  console.log(`Failed / Error: ${failedCount}`);

  fs.writeFileSync('scratch/tunnel_test_results.json', JSON.stringify(results, null, 2));
  console.log(`Results saved to scratch/tunnel_test_results.json`);
}

executeTestRun();
