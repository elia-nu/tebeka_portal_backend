const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AttorneysController } = require('../apps/user-service/src/modules/attorneys/attorneys.controller');
const { AttorneysService } = require('../apps/user-service/src/modules/attorneys/attorneys.service');
const { UsersService } = require('../apps/user-service/src/modules/users/users.service');

async function testPatchFormdata() {
  console.log('Testing PATCH /attorneys/me and PATCH /attorneys/:id with form-data...');

  const attorneysService = new AttorneysService();
  const usersService = new UsersService();
  const controller = new AttorneysController(attorneysService, usersService);

  let profile = await prisma.attorneyProfile.findFirst({
    where: { user: { role: 'ATTORNEY' } }
  });

  if (!profile) {
    const user = await prisma.user.create({
      data: {
        phone: `+2519${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `patch_formdata_test_${Date.now()}@tebeka.et`,
        name: 'Patch Formdata Attorney',
        role: 'ATTORNEY',
        status: 'ACTIVE',
        attorneyProfile: {
          create: {
            barRegistrationNumber: 'BAR-FORM-101',
            verificationStatus: 'DRAFT',
            status: 'DRAFT'
          }
        }
      },
      include: { attorneyProfile: true }
    });
    profile = user.attorneyProfile;
  }

  const rawFormdataBody = {
    nationalIdNumber: 'ETH-FORM-999',
    nationalIdDocument: 'credentials/formdata_national_id.pdf'
  };

  const res = await controller.updateAttorney(profile.id, [], rawFormdataBody);
  console.log('Controller Update Result:', res);

  const updatedProfile = await attorneysService.findOne(profile.id);
  console.log('Updated National ID Number:', updatedProfile.nationalIdNumber);
  console.log('Updated National ID Doc URL:', updatedProfile.nationalIdDocumentUrl);

  if (updatedProfile.nationalIdNumber !== 'ETH-FORM-999' || !updatedProfile.nationalIdDocumentUrl) {
    throw new Error('FAILED: Formdata PATCH update failed to persist nationalIdNumber or nationalIdDocumentUrl!');
  }

  console.log('✅ ALL FORM-DATA PATCH TESTS PASSED CLEANLY!');
  await prisma.$disconnect();
}

testPatchFormdata().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
