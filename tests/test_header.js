require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testHeaderSupport() {
  console.log(`\n======================================================`);
  console.log(`=== Testing X-OTP-Continuation-Token Header Support ===`);
  console.log(`======================================================\n`);

  // 1. Create a dummy valid OtpCode record in DB with continuationToken
  const testPhone = '+251911887766';
  const continuationToken = `otp_cont_test_${Date.now()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Clean existing client with this phone
  await prisma.user.deleteMany({ where: { phone: testPhone, role: 'CLIENT' } });

  const otpRecord = await prisma.otpCode.create({
    data: {
      phone: testPhone,
      purpose: 'REGISTRATION',
      codeHash: '123456',
      continuationToken,
      expiresAt,
      usedAt: null
    }
  });

  console.log(`[DB] Created test OTP record with continuationToken: ${continuationToken}`);

  // 2. Simulate AuthController header resolution
  const req = {
    headers: {
      'x-otp-continuation-token': continuationToken
    }
  };
  const body = {
    phone: testPhone,
    firstName: 'HeaderTest',
    lastName: 'Client',
    email: 'headertest@example.com'
  };
  const query = {};

  const headerToken = req.headers['x-otp-continuation-token'] || req.headers['x-continuation-token'];
  const queryToken = query?.otpContinuationToken || query?.continuationToken;
  const resolvedToken = headerToken || queryToken || body?.otpContinuationToken;

  console.log(`[Controller Test] Extracted Token from Headers: ${resolvedToken}`);

  // 3. Verify OTP continuation token against DB
  const foundOtp = await prisma.otpCode.findUnique({
    where: { continuationToken: resolvedToken }
  });

  if (foundOtp && !foundOtp.usedAt && foundOtp.expiresAt > new Date()) {
    console.log(`[DB] Validated continuationToken successfully!`);
    await prisma.otpCode.update({
      where: { id: foundOtp.id },
      data: { usedAt: new Date() }
    });

    const user = await prisma.user.create({
      data: {
        phone: testPhone,
        email: body.email,
        name: 'HeaderTest Client',
        role: 'CLIENT',
        status: 'ACTIVE',
        phoneVerified: true
      }
    });

    console.log(`✅ [REGISTRATION SUCCESS] User created with ID: ${user.id}, phone: ${user.phone}`);
  } else {
    console.log(`❌ Token validation failed.`);
  }

  console.log(`\n======================================================\n`);
}

testHeaderSupport()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('❌ Error:', err);
    prisma.$disconnect();
  });
