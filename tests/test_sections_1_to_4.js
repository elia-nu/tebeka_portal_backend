const fs = require('fs');
const path = require('path');

async function runTests() {
  const collectionPath = fs.existsSync(path.join(__dirname, 'Tebeka_User_Service_Postman_Collection.json'))
    ? path.join(__dirname, 'Tebeka_User_Service_Postman_Collection.json')
    : path.join(__dirname, '../Tebeka_User_Service_Postman_Collection.json');

  const collection = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const baseUrl = 'http://127.0.0.1:3001/api/v1';

  let adminToken = '';
  let checkerToken = '';
  let clientToken = '';
  let attorneyToken = '';
  let attorneyProfileId = 'attorney-123';
  let attorneySlug = 'attorney-abebe-bikila';
  let verificationCaseId = 'case-123';
  let unflaggedCaseId = 'case-123';
  let checkItemId = 'identity_match';
  let educationId = 'edu-123';
  let availabilityId = 'avail-123';
  let practiceAreaId = 'pa-123';
  let lastOtpToken = '';
  let newlyRegisteredClientEmail = 'client.user@tebeka.et';

  const validBioEn = 'Senior Corporate and Intellectual Property Law Specialist with over 12 years of experience in commercial litigation, merger and acquisitions, and cross-border regulatory compliance.';
  const validBioAm = 'በንግድ እና የንብረት ህግ ዙሪያ ከ12 ዓመት በላይ ልምድ ያላቸው የህግ ባለሙያ። በንግድ ውል ድርድር፣ በድርጅቶች ውህደት እና በሀገር አቀፍ የህግ ጉዳዮች ላይ የተካኑ ህግ አዋቂ ናቸው።';

  async function login(email, password) {
    try {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      return { token: data.token || data.accessToken || '', user: data.user || {} };
    } catch (e) {
      return { token: '', user: {} };
    }
  }

  console.log('--- 1. Authenticating Test Users ---');
  const adminAuth = await login('admin@tebeka.et', 'Password@123');
  adminToken = adminAuth.token;

  const checkerAuth = await login('regional.admin@tebeka.et', 'Password@123');
  checkerToken = checkerAuth.token || adminToken;

  const clientAuth = await login('client.user@tebeka.et', 'Password@123');
  clientToken = clientAuth.token;

  const attorneyAuth = await login('dawit.solomon@tebekalaw.et', 'Password@123');
  attorneyToken = attorneyAuth.token;

  console.log(`Admin Token: ${adminToken ? 'OK' : 'Failed'}`);
  console.log(`Checker Admin Token: ${checkerToken ? 'OK' : 'Failed'}`);
  console.log(`Client Token: ${clientToken ? 'OK' : 'Failed'}`);
  console.log(`Attorney Token: ${attorneyToken ? 'OK' : 'Failed'}`);

  // Fetch Attorney Profile & Slug
  if (attorneyToken) {
    try {
      const profileRes = await fetch(`${baseUrl}/attorneys/me`, {
        headers: { 'Authorization': `Bearer ${attorneyToken}`, 'Cookie': `better-auth.session_token=${attorneyToken}` }
      });
      const profileData = await profileRes.json();
      if (profileData && profileData.id) {
        attorneyProfileId = profileData.id;
        console.log(`Fetched active attorney profile ID: ${attorneyProfileId}`);
      }
    } catch (e) {}
  }

  // Fetch Public Attorney Slug from Discovery
  try {
    const discRes = await fetch(`${baseUrl}/discovery/attorneys`);
    const discData = await discRes.json();
    const items = Array.isArray(discData) ? discData : (discData.items || []);
    if (items.length > 0) {
      attorneySlug = items[0].slug || items[0].id || attorneySlug;
      console.log(`Fetched public attorney slug/ID: ${attorneySlug}`);
    }
  } catch (e) {}

  // Fetch or Create Verification Case ID for Admin testing
  if (adminToken) {
    try {
      const caseRes = await fetch(`${baseUrl}/verifications`, {
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Cookie': `better-auth.session_token=${adminToken}` }
      });
      const caseData = await caseRes.json();
      const items = Array.isArray(caseData) ? caseData : (caseData.items || []);
      if (items.length > 0) {
        verificationCaseId = items[0].id;
        unflaggedCaseId = items[items.length - 1].id;
        if (items[0].checklist && items[0].checklist.length > 0) {
          checkItemId = items[0].checklist[0].id;
        }
      } else {
        const createRes = await fetch(`${baseUrl}/verifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ attorneyId: attorneyProfileId })
        });
        const createdData = await createRes.json();
        if (createdData && createdData.id) {
          verificationCaseId = createdData.id;
          unflaggedCaseId = createdData.id;
        }
      }
      console.log(`Active verification case ID for test runner: ${verificationCaseId}`);
    } catch (e) {}
  }

  const folderIndices = [0, 1, 2, 3, 4];
  const results = [];

  for (const idx of folderIndices) {
    const folder = collection.item[idx];
    console.log(`\n==================================================`);
    console.log(`Testing Folder: ${folder.name}`);
    console.log(`==================================================`);

    for (const item of folder.item) {
      const req = item.request;
      const method = req.method;
      let urlStr = req.url.raw || '';

      let body = req.body && req.body.raw ? req.body.raw : undefined;

      // Select active token depending on folder persona
      let activeToken = '';
      if (idx === 1) activeToken = clientToken;
      else if (idx === 2 || idx === 3) activeToken = attorneyToken;
      else if (idx === 4) activeToken = adminToken;

      const uniquePhone = `+2519${Math.floor(10000000 + Math.random() * 90000000)}`;

      if (item.name.includes('1.9 GET Public Attorney Profile by Slug')) {
        urlStr = `${baseUrl}/discovery/attorneys/${attorneySlug}`;
      }
      if (item.name.includes('OTP Request') || item.name.includes('1.1') || item.name.includes('2.1') || item.name.includes('3.1')) {
        body = JSON.stringify({ phone: uniquePhone });
      }
      if (item.name.includes('OTP Verify') || item.name.includes('1.2') || item.name.includes('2.2') || item.name.includes('3.2')) {
        body = JSON.stringify({ phone: uniquePhone, code: '123456' });
      }
      if (item.name.includes('2.10 Send Email') || item.name.includes('Resend Email')) {
        body = JSON.stringify({ email: newlyRegisteredClientEmail });
      }
      if (item.name.includes('2.11 Verify Email') || item.name.includes('3.5 Verify Email')) {
        body = JSON.stringify({ email: newlyRegisteredClientEmail, code: '123456', otp: '123456' });
      }
      if (item.name.includes('2.3 Register Client Account') || item.name.includes('register/client')) {
        newlyRegisteredClientEmail = `test.client.${Date.now()}@tebeka.et`;
        body = JSON.stringify({
          name: 'Demo Client User',
          email: newlyRegisteredClientEmail,
          phone: uniquePhone,
          password: 'Password@123',
          otpContinuationToken: lastOtpToken || `tok-${Date.now()}`
        });
      }
      if (item.name.includes('2.4 Client Login')) {
        body = JSON.stringify({ email: newlyRegisteredClientEmail, password: 'Password@123' });
      }
      if (item.name.includes('3.3 Register Attorney') || item.name.includes('register/attorney')) {
        body = JSON.stringify({
          name: 'Demo Attorney User',
          email: `test.attorney.${Date.now()}@tebeka.et`,
          phone: uniquePhone,
          password: 'Password@123',
          barNumber: `BAR-${Date.now()}`,
          otpContinuationToken: lastOtpToken || `tok-${Date.now()}`
        });
      }
      if (item.name.includes('3.4 Attorney Login')) {
        body = JSON.stringify({ email: 'dawit.solomon@tebekalaw.et', password: 'Password@123' });
      }
      if (item.name.includes('3.5 POST Add Education') || item.name.includes('Add Education')) {
        body = JSON.stringify({
          institution: 'Addis Ababa University',
          degree: 'LL.B in Commercial Law',
          graduationYear: 2018
        });
      }
      if (item.name.includes('3.7 PATCH Open vs Guarded Fields')) {
        body = JSON.stringify({
          bioEn: validBioEn,
          bioAm: validBioAm,
          officeAddress: 'Bole Road, Mega Building 4th Floor',
          consultationFee: 1500
        });
      }
      if (item.name.includes('4.1 Admin Login')) {
        body = JSON.stringify({ email: 'admin@tebeka.et', password: 'Password@123' });
      }
      if (item.name.includes('4.5 PATCH Update Bar Standing Check')) {
        body = JSON.stringify({ status: 'ACTIVE', notes: 'Standing verified with Federal Bar' });
      }
      if (item.name.includes('4.6 PATCH Evaluate Checklist Item')) {
        body = JSON.stringify({ status: 'PASSED', remarks: 'Identity document verified' });
      }
      if (item.name.includes('4.8 PATCH Approve Verification Case')) {
        urlStr = `${baseUrl}/verifications/${unflaggedCaseId}/approve`;
      }

      // Replace Placeholders
      urlStr = urlStr.replace('{{baseUrl}}', baseUrl)
                    .replace('{{attorneyProfileId}}', attorneyProfileId)
                    .replace('{{verificationCaseId}}', verificationCaseId)
                    .replace('{{checkItemId}}', checkItemId)
                    .replace('{{educationId}}', educationId)
                    .replace('{{availabilityId}}', availabilityId)
                    .replace('{{practiceAreaId}}', practiceAreaId)
                    .replace('{{contactTicketId}}', 'ticket-123');

      console.log(`\n▶ [${method}] ${item.name}`);
      console.log(`  URL: ${urlStr}`);

      let status = 0;
      let responseData = {};
      let responseSummary = '';

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

          // Capture OTP continuation token
          if (responseData && responseData.otpContinuationToken) {
            lastOtpToken = responseData.otpContinuationToken;
          }

          // Capture client login token
          if (item.name.includes('2.4 Client Login') && responseData && responseData.token) {
            clientToken = responseData.token;
          }

          // Capture unflagged case ID from 3.3 Register Attorney response
          if (item.name.includes('3.3 Register Attorney') && responseData && responseData.user?.attorneyProfile?.verificationCase?.id) {
            unflaggedCaseId = responseData.user.attorneyProfile.verificationCase.id;
          }

          // Dynamic ID capture
          if (item.name.includes('Add Education') && responseData && (responseData.id || responseData.item?.id)) {
            educationId = responseData.id || responseData.item?.id;
          }
          if (item.name.includes('Add Availability') && responseData && (responseData.id || responseData.item?.id)) {
            availabilityId = responseData.id || responseData.item?.id;
          }

          break;
        } catch (error) {
          responseSummary = error.message;
          break;
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
  console.log(`SUMMARY REPORT FOR SECTIONS 01-04`);
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
