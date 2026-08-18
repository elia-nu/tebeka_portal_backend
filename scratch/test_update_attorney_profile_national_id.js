const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { AttorneysService } = require('../apps/user-service/src/modules/attorneys/attorneys.service');

async function testUpdateAttorneyProfileNationalId() {
  console.log('Testing Attorney Profile Update with National ID...');

  const attorneysService = new AttorneysService();

  // Find or create test profile
  let profile = await prisma.attorneyProfile.findFirst({
    where: { user: { role: 'ATTORNEY' } }
  });

  if (!profile) {
    const user = await prisma.user.create({
      data: {
        phone: `+2519${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `profile_update_test_${Date.now()}@tebeka.et`,
        name: 'Test Profile Attorney',
        role: 'ATTORNEY',
        status: 'ACTIVE',
        attorneyProfile: {
          create: {
            barRegistrationNumber: 'BAR-TEST-100',
            verificationStatus: 'DRAFT',
            status: 'DRAFT'
          }
        }
      },
      include: { attorneyProfile: true }
    });
    profile = user.attorneyProfile;
  }

  console.log(`Updating attorney profile ID: ${profile.id}...`);

  const updateResult = await attorneysService.updateAttorney(profile.id, {
    nationalIdNumber: 'ETH-UPDATE-ID-999',
    nationalIdDocument: 'credentials/updated_national_id.pdf',
    licenseBook: 'credentials/updated_license.pdf'
  });

  console.log('Update Result:', updateResult);

  // Fetch updated profile
  const updatedProfile = await attorneysService.findOne(profile.id);
  console.log('Updated Profile Data:');
  console.log(' - nationalIdNumber:', updatedProfile.nationalIdNumber);
  console.log(' - nationalIdDocumentUrl:', updatedProfile.nationalIdDocumentUrl);
  console.log(' - licenseBookUrl:', updatedProfile.licenseBookUrl);
  console.log(' - Credentials count:', updatedProfile.credentials ? updatedProfile.credentials.length : 0);

  if (updatedProfile.nationalIdNumber !== 'ETH-UPDATE-ID-999' || !updatedProfile.nationalIdDocumentUrl) {
    throw new Error('FAILED: National ID updates were not saved properly!');
  }

  console.log('✅ ATTORNEY PROFILE UPDATE WITH NATIONAL ID PASSED SUCCESSFULLY!');
  await prisma.$disconnect();
}

testUpdateAttorneyProfileNationalId().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
