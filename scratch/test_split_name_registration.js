const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AuthService } = require('../apps/user-service/src/modules/auth/auth.service');

async function testSplitNameRegistration() {
  console.log('Testing attorney registration with firstName, middleName, and surName...');

  const authService = new AuthService();
  const testPhone = `+2519${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testEmail = `split_name_${Date.now()}@tebeka.et`;

  // Verify email OTP first
  const verifyRes = await authService.verifyEmail({
    email: testEmail,
    code: '123456'
  });
  const emailToken = verifyRes.emailContinuationToken;

  // Register attorney with firstName, middleName, surName
  const payload = {
    firstName: 'Dawit',
    middleName: 'Solomon',
    surName: 'Desalegn',
    email: testEmail,
    password: 'AttorneyPass123!',
    phone: testPhone,
    barRegistrationNumber: `BAR-${Math.floor(1000 + Math.random() * 9000)}`,
    barAdmissionYear: 2021,
    emailContinuationToken: emailToken
  };

  const regRes = await authService.registerAttorney(payload);
  console.log('Registration response status:', regRes.status);
  console.log('Registered User Name:', regRes.user.name);

  if (regRes.user.name !== 'Dawit Solomon Desalegn') {
    throw new Error(`FAILED: Expected "Dawit Solomon Desalegn" but got "${regRes.user.name}"`);
  }

  // Cleanup
  const createdUser = await prisma.user.findFirst({ where: { email: testEmail } });
  if (createdUser) {
    await prisma.attorneyProfile.deleteMany({ where: { userId: createdUser.id } });
    await prisma.user.delete({ where: { id: createdUser.id } });
  }

  console.log('✅ SPLIT NAME (firstName, middleName, surName) REGISTRATION PASSED CLEANLY!');
  await prisma.$disconnect();
}

testSplitNameRegistration().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
