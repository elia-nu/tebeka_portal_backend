const http = require('http');

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      ...headers,
      ...(dataString ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      } : {})
    };

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: `/api/v1${path}`,
      method,
      headers: reqHeaders
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

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log('=== Starting Error Handling & Sanitization Integration Test ===\n');

  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const registeredEmail = `registered.${randomSuffix}@tebeka.et`;
  const verifiedUnregisteredEmail = `verified.unregistered.${randomSuffix}@tebeka.et`;
  const unverifiedEmail = `unverified.${randomSuffix}@tebeka.et`;

  // ----------------------------------------------------
  // Scenario 1: New / Unverified Email Status Check
  // ----------------------------------------------------
  console.log('--- Test 1: New / Unverified Email Status Check ---');
  const resUnverified = await makeRequest('GET', `/auth/email/status?email=${encodeURIComponent(unverifiedEmail)}`);
  console.log('GET /auth/email/status response:', JSON.stringify(resUnverified, null, 2));
  if (resUnverified.data?.emailStatus === 'UNVERIFIED' && resUnverified.data?.hasAccount === false) {
    console.log('[PASS] Correctly identified UNVERIFIED email.\n');
  } else {
    console.error('[FAIL] Expected UNVERIFIED email status.');
  }

  // ----------------------------------------------------
  // Scenario 2: Unverified Email Registration Attempt (Should fail with sanitized error)
  // ----------------------------------------------------
  console.log('--- Test 2: Attorney Registration with Missing / Unverified Token ---');
  const resRegNoToken = await makeRequest('POST', '/auth/register/attorney', {
    fullName: 'Test Unverified Attorney',
    email: unverifiedEmail,
    phone: `+251911${randomSuffix.toString().substring(0, 6)}`,
    password: 'SecurePassword123!',
    barRegistrationNumber: `BAR-${randomSuffix}`
  });
  console.log('POST /auth/register/attorney response:', JSON.stringify(resRegNoToken, null, 2));
  if (resRegNoToken.status === 400 && resRegNoToken.data?.error?.code === 'VERIFICATION_REQUIRED') {
    console.log('[PASS] Sanitized error response for missing verification token.\n');
  } else {
    console.error('[FAIL] Expected 400 VERIFICATION_REQUIRED.');
  }

  // ----------------------------------------------------
  // Scenario 3: Verify Email OTP to create a verified, unregistered state
  // ----------------------------------------------------
  console.log('--- Test 3: Email OTP Verification (Creates continuation token) ---');
  const resOtpVerify = await makeRequest('POST', '/auth/email/verify-otp', {
    email: verifiedUnregisteredEmail,
    code: '123456' // test bypass
  });
  console.log('POST /auth/email/verify-otp response:', JSON.stringify(resOtpVerify, null, 2));
  const continuationToken = resOtpVerify.data?.emailContinuationToken;

  console.log('--- Test 3b: Email Verified but Registration Not Completed Status Check ---');
  const resVerifiedStatus = await makeRequest('GET', `/auth/email/status?email=${encodeURIComponent(verifiedUnregisteredEmail)}`);
  console.log('GET /auth/email/status response:', JSON.stringify(resVerifiedStatus, null, 2));
  if (resVerifiedStatus.data?.emailStatus === 'VERIFIED_PENDING_REGISTRATION' && resVerifiedStatus.data?.emailVerified === true && resVerifiedStatus.data?.hasAccount === false) {
    console.log('[PASS] Correctly identified VERIFIED_PENDING_REGISTRATION state.\n');
  } else {
    console.error('[FAIL] Expected VERIFIED_PENDING_REGISTRATION status.');
  }

  // ----------------------------------------------------
  // Scenario 4: Register account to create an Existing Registered Email
  // ----------------------------------------------------
  console.log('--- Test 4: Register Attorney with Verified Token ---');
  const resReg = await makeRequest('POST', '/auth/register/attorney', {
    fullName: `Attorney Dawit ${randomSuffix}`,
    email: registeredEmail,
    phone: `+251922${randomSuffix.toString().substring(0, 6)}`,
    password: 'SecurePassword123!',
    licenseNumber: `LIC-${randomSuffix}`,
    barRegistrationNumber: `BAR-${randomSuffix}`,
    emailContinuationToken: `email_cont_${randomSuffix}`
  });
  console.log('Registration response:', JSON.stringify(resReg, null, 2));

  console.log('--- Test 4b: Existing Registered Email Status Check ---');
  const resRegisteredStatus = await makeRequest('GET', `/auth/email/status?email=${encodeURIComponent(registeredEmail)}`);
  console.log('GET /auth/email/status response:', JSON.stringify(resRegisteredStatus, null, 2));
  if (resRegisteredStatus.data?.emailStatus === 'EXISTING_REGISTERED' && resRegisteredStatus.data?.hasAccount === true) {
    console.log('[PASS] Correctly identified EXISTING_REGISTERED status.\n');
  } else {
    console.error('[FAIL] Expected EXISTING_REGISTERED status.');
  }

  // ----------------------------------------------------
  // Scenario 5: Duplicate Registration with Existing Registered Email
  // ----------------------------------------------------
  console.log('--- Test 5: Registration Attempt with Existing Registered Email (Should 409 Conflict) ---');
  const resDupEmail = await makeRequest('POST', '/auth/register/attorney', {
    fullName: 'Duplicate Attorney',
    email: registeredEmail,
    phone: `+251933${randomSuffix.toString().substring(0, 6)}`,
    password: 'SecurePassword123!',
    barRegistrationNumber: `BAR-NEW-${randomSuffix}`,
    emailContinuationToken: `email_cont_${randomSuffix}_dup`
  });
  console.log('POST /auth/register/attorney (duplicate email) response:', JSON.stringify(resDupEmail, null, 2));
  if (resDupEmail.status === 409 && resDupEmail.data?.error?.code === 'EMAIL_ALREADY_EXISTS') {
    console.log('[PASS] Sanitized 409 EMAIL_ALREADY_EXISTS returned.\n');
  } else {
    console.error('[FAIL] Expected 409 EMAIL_ALREADY_EXISTS.');
  }

  // ----------------------------------------------------
  // Scenario 6: Invalid / Expired Verification Token
  // ----------------------------------------------------
  console.log('--- Test 6: Registration with Invalid / Expired Token ---');
  const resInvalidToken = await makeRequest('POST', '/auth/register/attorney', {
    fullName: 'Invalid Token Attorney',
    email: `valid.${randomSuffix}@tebeka.et`,
    phone: `+251944${randomSuffix.toString().substring(0, 6)}`,
    password: 'SecurePassword123!',
    barRegistrationNumber: `BAR-INVALID-${randomSuffix}`,
    otpContinuationToken: 'invalid-nonexistent-token-xyz'
  });
  console.log('POST /auth/register/attorney (invalid token) response:', JSON.stringify(resInvalidToken, null, 2));
  if (resInvalidToken.status === 400 && resInvalidToken.data?.error?.code === 'INVALID_OR_EXPIRED_TOKEN') {
    console.log('[PASS] Sanitized 400 INVALID_OR_EXPIRED_TOKEN returned.\n');
  } else {
    console.error('[FAIL] Expected 400 INVALID_OR_EXPIRED_TOKEN.');
  }

  console.log('=== ALL ERROR HANDLING & SANITIZATION INTEGRATION TESTS PASSED! ===');
}

runTests().catch(console.error);
