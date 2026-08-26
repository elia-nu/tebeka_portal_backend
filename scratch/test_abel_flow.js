const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAndClean() {
  const email = 'abeldesalegn97@gmail.com';
  console.log('--- 1. Checking DB for email:', email);
  
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) {
    console.log(`Found existing user: ID=${user.id}, Name=${user.name}, Role=${user.role}, Phone=${user.phone}`);
    // Delete any dependent records
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.attorneyProfile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`✅ Successfully removed existing user: ${email}`);
  } else {
    console.log(`ℹ️ User ${email} does not exist in the database.`);
  }

  // Clean old verifications
  const delVer = await prisma.verification.deleteMany({ where: { identifier: email } });
  console.log(`Cleaned ${delVer.count} existing verification records for ${email}`);
}

async function testRegistrationFlow() {
  const email = 'abeldesalegn97@gmail.com';
  const phone = '+251911887766';
  
  // Also clean phone if exists
  const existingPhone = await prisma.user.findFirst({ where: { phone } });
  if (existingPhone) {
    console.log(`Removing existing user with phone ${phone}...`);
    await prisma.session.deleteMany({ where: { userId: existingPhone.id } });
    await prisma.account.deleteMany({ where: { userId: existingPhone.id } });
    await prisma.attorneyProfile.deleteMany({ where: { userId: existingPhone.id } });
    await prisma.user.delete({ where: { id: existingPhone.id } });
  }
  await prisma.otpCode.deleteMany({ where: { phone } });

  console.log('\n--- 2. Testing HTTP Request: Send Email OTP ---');
  const sendRes = await fetch('http://localhost:5000/api/v1/auth/email/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const sendData = await sendRes.json();
  console.log('Send Email OTP Response (Status ' + sendRes.status + '):', sendData);

  console.log('\n--- 3. Fetching raw OTP code from DB (simulating user receiving email) ---');
  const verRecord = await prisma.verification.findFirst({
    where: { identifier: email },
    orderBy: { createdAt: 'desc' }
  });
  console.log('Stored verification record found:', verRecord ? { id: verRecord.id, identifier: verRecord.identifier, expiresAt: verRecord.expiresAt } : 'None');

  console.log('\n--- 4. Testing invalid OTP code rejection (Should Fail 400) ---');
  const fakeVerifyRes = await fetch('http://localhost:5000/api/v1/auth/email/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: '999999' })
  });
  const fakeVerifyData = await fakeVerifyRes.json();
  console.log('Fake Code Verification Response (Status ' + fakeVerifyRes.status + '):', fakeVerifyData);

  console.log('\n--- 5. Testing Registration without valid token (Should Fail 400) ---');
  const fakeRegRes = await fetch('http://localhost:5000/api/v1/auth/register/client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      name: 'Abel Desalegn',
      phone,
      password: 'StrongPassword123!',
      emailContinuationToken: 'fake_mock_token_123'
    })
  });
  const fakeRegData = await fakeRegRes.json();
  console.log('Fake Token Registration Response (Status ' + fakeRegRes.status + '):', fakeRegData);
}

async function run() {
  try {
    await checkAndClean();
    await testRegistrationFlow();
  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
