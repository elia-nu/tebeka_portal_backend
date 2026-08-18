const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AuthService } = require('../apps/user-service/src/modules/auth/auth.service');

async function testEmailContinuationFlow() {
  console.log('Testing Email OTP verification & registration continuation token flow...');

  const authService = new AuthService();
  const testEmail = `token_flow_${Date.now()}@tebeka.et`;
  const testPhone = `+2519${Math.floor(10000000 + Math.random() * 90000000)}`;

  // 1. Verify Email OTP (obtain continuation token)
  const verifyRes = await authService.verifyEmail({
    email: testEmail,
    code: '123456'
  });

  console.log('Verify Email OTP Response:', verifyRes);
  const token = verifyRes.emailContinuationToken;
  if (!token) {
    throw new Error('FAILED: No emailContinuationToken returned!');
  }

  // 2. Perform registration with the continuation token
  const regPayload = {
    name: 'Continuation Token Test Attorney',
    email: testEmail,
    password: 'AttorneyPass123!',
    phone: testPhone,
    barRegistrationNumber: 'BAR-TOK-1234',
    barAdmissionYear: '2021',
    emailContinuationToken: token
  };

  const regRes = await authService.registerAttorney(regPayload);
  console.log('Attorney Registration Success:', regRes.status, regRes.message);

  // 3. Test clean cleanup
  const createdUser = await prisma.user.findFirst({ where: { email: testEmail } });
  if (createdUser) {
    await prisma.attorneyProfile.deleteMany({ where: { userId: createdUser.id } });
    await prisma.user.delete({ where: { id: createdUser.id } });
  }

  console.log('✅ ALL EMAIL CONTINUATION TOKEN FLOW TESTS PASSED!');
  await prisma.$disconnect();
}

testEmailContinuationFlow().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
