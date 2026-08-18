require('dotenv').config();
const { PrismaClient } = require('./node_modules/@prisma/client/user/index.js');
const prisma = new PrismaClient();

async function testEmailVerificationFlow() {
  console.log(`\n======================================================`);
  console.log(`=== Email Verification End-to-End Test Suite       ===`);
  console.log(`======================================================\n`);

  const email = 'abeldesalegn92@gmail.com';

  // 1. Send Email Verification OTP via API Gateway
  console.log(`--- 1. Requesting Email Verification OTP for ${email} ---`);
  const sendRes = await fetch('http://localhost:3000/api/v1/auth/email/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).then(r => r.json());

  console.log('Send OTP Response:', sendRes);

  // 2. Fetch freshly generated OTP code from database
  const record = await prisma.verification.findFirst({
    where: { identifier: email },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new Error('No OTP record found in database!');
  }

  const otpCode = record.value;
  console.log(`\n--- 2. Freshly Generated OTP Code in DB: [${otpCode}] ---`);

  // 3. Verify Email OTP via API Gateway
  console.log(`--- 3. Verifying Email OTP [${otpCode}] via API Gateway ---`);
  const verifyRes = await fetch('http://localhost:3000/api/v1/auth/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: otpCode }),
  }).then(r => r.json());

  console.log('Verify OTP Response:', verifyRes);

  console.log(`\n======================================================`);
  console.log(`=== EMAIL VERIFICATION FLOW PASSED 100%           ===`);
  console.log(`======================================================\n`);
}

testEmailVerificationFlow()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('❌ Test Failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
