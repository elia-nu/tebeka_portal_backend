require('dotenv').config();
const { PrismaClient } = require('./node_modules/@prisma/client/user/index.js');
const prisma = new PrismaClient();

async function testTransactionalDualRegistration() {
  console.log(`\n========================================================================`);
  console.log(`=== Transactional Dual SMS & Email OTP Registration Test Suite       ===`);
  console.log(`========================================================================\n`);

  const phone = `+251911${Math.floor(100000 + Math.random() * 900000)}`;
  const email = `test_client_${Date.now()}@example.com`;

  // 1. Request SMS OTP
  console.log(`--- 1. Requesting SMS OTP for phone ${phone} ---`);
  await fetch('http://localhost:3000/api/v1/auth/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  }).then(r => r.json());

  // Get SMS OTP code from DB
  const smsOtpRecord = await prisma.otpCode.findFirst({
    where: { phone },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`SMS OTP Code: [${smsOtpRecord.codeHash}]`);

  // Verify SMS OTP to mint otpContinuationToken
  const smsVerifyRes = await fetch('http://localhost:3000/api/v1/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code: smsOtpRecord.codeHash }),
  }).then(r => r.json());

  const otpContinuationToken = smsVerifyRes.otpContinuationToken;
  console.log(`✅ Minted SMS Continuation Token: [${otpContinuationToken}]`);

  // 2. Request Email OTP
  console.log(`\n--- 2. Requesting Email OTP for ${email} ---`);
  await fetch('http://localhost:3000/api/v1/auth/email/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(r => r.json());

  // Get Email OTP code from DB
  const emailOtpRecord = await prisma.verification.findFirst({
    where: { identifier: email },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Email OTP Code: [${emailOtpRecord.value}]`);

  // Verify Email OTP to mint emailContinuationToken
  const emailVerifyRes = await fetch('http://localhost:3000/api/v1/auth/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: emailOtpRecord.value }),
  }).then(r => r.json());

  const emailContinuationToken = emailVerifyRes.emailContinuationToken;
  console.log(`✅ Minted Email Continuation Token: [${emailContinuationToken}]`);

  // 3. Perform Transactional Client Registration with Email-Only Token
  console.log(`\n--- 3. Submitting Transactional Client Registration with Email Token ONLY ---`);
  const registerRes = await fetch('http://localhost:3000/api/v1/auth/register/client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Abel Desalegn',
      phone,
      email,
      password: 'SecurePassword123!',
      emailContinuationToken,
    }),
  }).then(r => r.json());

  console.log('Registration Result:', registerRes);

  // 4. Test Logging in with registered credentials
  console.log(`\n--- 4. Testing Login for ${email} ---`);
  const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'SecurePassword123!',
    }),
  }).then(r => r.json());

  console.log('Login Result:', loginRes);

  // 5. Verify DB State for atomic correctness
  const createdUser = await prisma.user.findFirst({
    where: { email },
  });

  console.log(`\n--- 5. Verified Database State ---`);
  console.log(`User ID: ${createdUser.id}`);
  console.log(`Name: ${createdUser.name}`);
  console.log(`Phone: ${createdUser.phone} | Phone Verified: ${createdUser.phoneVerified}`);
  console.log(`Email: ${createdUser.email} | Email Verified: ${createdUser.emailVerified}`);

  if (registerRes.user.name === 'Abel Desalegn' && createdUser.name === 'Abel Desalegn' && registerRes.token && loginRes.token && createdUser.emailVerified === true) {
    console.log(`\n========================================================================`);
    console.log(`=== TRANSACTIONAL REGISTRATION WITH NAME & LOGIN PASSED 100%          ===`);
    console.log(`========================================================================\n`);
  } else {
    throw new Error(`Name or registration token failed! Expected 'Abel Desalegn', got '${createdUser.name}'`);
  }
}

testTransactionalDualRegistration()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('❌ Test Failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
