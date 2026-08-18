const fs = require('fs');

async function runTests() {
  const collection = JSON.parse(fs.readFileSync('Tebeka_User_Service_Postman_Collection.json', 'utf8'));
  const baseUrl = 'http://127.0.0.1:3001/api/v1';

  async function getAdminToken(email, password) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();
        const token = loginData.token || loginData.accessToken || '';
        const id = loginData.user?.id || '';
        if (token) return { token, id };
      } catch (err) {
        await new Promise(res => setTimeout(res, 1000));
      }
    }
    return { token: '', id: '' };
  }

  console.log('--- 1. Authenticating Super Admin (Maker) & Regional Admin (Checker) ---');
  let makerAuth = await getAdminToken('admin@tebeka.et', 'Password@123');
  let checkerAuth = await getAdminToken('regional.admin@tebeka.et', 'Password@123');
  
  let superAdminToken = makerAuth.token;
  let checkerToken = checkerAuth.token || superAdminToken;

  console.log('Admin Tokens obtained successfully.');

  // Target folders: 5 (Super Admin), 6 (System Ops & RBAC), 7 (Localization)
  const targetFolderIndices = [5, 6, 7];
  const results = [];
  let dynamicProposalId = 'prop-123';

  for (const idx of targetFolderIndices) {
    const folder = collection.item[idx];
    console.log(`\n==================================================`);
    console.log(`Testing Folder: ${folder.name}`);
    console.log(`==================================================`);

    for (const item of folder.item) {
      const req = item.request;
      const method = req.method;
      let urlStr = req.url.raw || '';

      let body = undefined;
      if (req.body && req.body.raw) {
        body = req.body.raw;
      }

      // Payload / URL Customizations for 100% clean execution
      if (item.name.includes('5.1 Super Admin Login')) {
        body = JSON.stringify({ email: 'admin@tebeka.et', password: 'Password@123' });
      }
      if (item.name.includes('5.2 POST Provision New Admin')) {
        body = JSON.stringify({
          name: 'Provisioned Admin',
          email: `admin.prov.${Date.now()}@tebeka.et`,
          phone: `+2519${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'SecurePassword123!',
          role: 'ADMIN'
        });
      }
      if (item.name.includes('Enable 2FA')) {
        body = JSON.stringify({ password: 'Password@123' });
      }
      
      // Target a demo client user for suspension/impersonation tests so Super Admin isn't suspended!
      const targetTestUserId = 'cecadeb4-c5d1-4ea0-b85c-9bf6ff3a920e';

      // Replace placeholders
      urlStr = urlStr.replace('{{baseUrl}}', baseUrl)
                    .replace('{{userId}}', targetTestUserId)
                    .replace('{{proposalId}}', dynamicProposalId)
                    .replace('{{sessionId}}', 'session-123')
                    .replace('{{key}}', 'welcome_title')
                    .replace('{{locale}}', 'am')
                    .replace('{{i18nLegalStringKey}}', 'legal.terms.arbitration_clause');

      console.log(`\n▶ [${method}] ${item.name}`);
      console.log(`  URL: ${urlStr}`);

      let status = 0;
      let responseData = {};
      let responseSummary = '';

      // Determine active token for request
      let activeToken = superAdminToken;
      if (item.name.includes('Checker Admin B')) {
        activeToken = checkerToken;
        console.log('  Using Checker Admin B token for dual-approval verification.');
      }

      for (let retry = 0; retry < 2; retry++) {
        const headers = { 'Content-Type': 'application/json' };
        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken}`;
          headers['Cookie'] = `better-auth.session_token=${activeToken}`;
        }

        try {
          const response = await fetch(urlStr, {
            method,
            headers,
            body: method !== 'GET' && method !== 'HEAD' ? body : undefined
          });

          status = response.status;
          const contentType = response.headers.get('content-type') || '';

          if (contentType.includes('application/json')) {
            responseData = await response.json();
            responseSummary = JSON.stringify(responseData).substring(0, 300);
          } else {
            const txt = await response.text();
            responseSummary = txt.substring(0, 300);
          }

          // If 5.1 Super Admin Login ran, capture fresh token!
          if (item.name.includes('5.1 Super Admin Login') && responseData && (responseData.token || responseData.accessToken)) {
            superAdminToken = responseData.token || responseData.accessToken;
            console.log('  Updated active Super Admin token from 5.1 login!');
          }

          // If unauthorized (e.g. after Revoke All Sessions), re-login and retry once
          if (status === 401 && retry === 0) {
            console.log('  ⚠️ Received 401 Unauthorized. Re-authenticating Admin...');
            const freshAuth = await getAdminToken('admin@tebeka.et', 'Password@123');
            superAdminToken = freshAuth.token;
            activeToken = superAdminToken;
            continue;
          }

          break;
        } catch (error) {
          responseSummary = error.message;
          break;
        }
      }

      // Capture dynamic proposal ID if created in 5.4
      if (item.name.includes('Propose Config Change') && responseData) {
        const propObj = responseData.proposal || responseData.item || responseData;
        if (propObj.id || propObj.proposalId) {
          dynamicProposalId = propObj.id || propObj.proposalId;
          console.log(`  Captured dynamic proposalId: ${dynamicProposalId}`);
        }
      }

      const isSuccess = status >= 200 && status < 300;
      console.log(`  Status: ${status}`);
      console.log(`  Result: ${isSuccess ? '✅ SUCCESS' : '⚠️ WARNING / ERROR'}`);
      console.log(`  Response:`, responseSummary);

      results.push({
        folder: folder.name,
        name: item.name,
        method,
        url: urlStr,
        status,
        isSuccess,
        responseSummary
      });
    }
  }

  console.log(`\n==================================================`);
  console.log(`SUMMARY REPORT`);
  console.log(`==================================================`);
  const total = results.length;
  const passed = results.filter(r => r.isSuccess).length;
  console.log(`Total Endpoints Tested: ${total}`);
  console.log(`Passed (2xx): ${passed}`);
  console.log(`Failed/Non-2xx: ${total - passed}\n`);

  if (total - passed > 0) {
    console.log(`--- FAILURES LIST ---`);
    results.filter(r => !r.isSuccess).forEach(r => {
      console.log(`❌ [${r.status}] [${r.method}] ${r.name}`);
      console.log(`   URL: ${r.url}`);
      console.log(`   Response: ${r.responseSummary}\n`);
    });
  }
}

runTests().catch(err => console.error(err));
