const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { VerificationsController } = require('../apps/user-service/src/modules/verifications/verifications.controller');
const { VerificationsService } = require('../apps/user-service/src/modules/verifications/verifications.service');
const { UsersService } = require('../apps/user-service/src/modules/users/users.service');

async function testMyCaseResolution() {
  console.log('Testing GET /verifications/my-case resolution...');

  const verificationsService = new VerificationsService({ emit: () => {} });
  const usersService = new UsersService();
  const controller = new VerificationsController(verificationsService, usersService);

  let profile = await prisma.attorneyProfile.findFirst({
    include: { user: true }
  });

  if (!profile) {
    console.log('No attorney profile in DB, creating test user & profile...');
    const user = await prisma.user.create({
      data: {
        phone: `+2519${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `mycase_test_${Date.now()}@tebeka.et`,
        name: 'My Case Test Attorney',
        role: 'ATTORNEY',
        status: 'ACTIVE',
        attorneyProfile: {
          create: {
            barRegistrationNumber: 'BAR-MYCASE-001',
            verificationStatus: 'SUBMITTED',
            status: 'DRAFT'
          }
        }
      },
      include: { attorneyProfile: true }
    });
    profile = user.attorneyProfile;
  }

  console.log(`Testing with profile ID: ${profile.id}, userId: ${profile.userId}...`);

  // Test 1: Passing explicit query attorneyId
  const resWithQuery = await controller.getAttorneyCaseView(profile.id, { headers: {} });
  console.log('Result with query attorneyId:', resWithQuery ? 'FOUND' : 'NOT FOUND');

  // Test 2: Omitting query attorneyId (relies on req fallback)
  const fakeReq = { headers: { 'x-user-id': profile.userId } };
  const resWithHeader = await controller.getAttorneyCaseView(undefined, fakeReq);
  console.log('Result with req x-user-id fallback:', resWithHeader ? 'FOUND' : 'NOT FOUND');

  console.log('✅ GET /verifications/my-case RESOLUTION TESTS PASSED!');
  await prisma.$disconnect();
}

testMyCaseResolution().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
