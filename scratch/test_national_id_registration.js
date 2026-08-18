const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNationalIdFlow() {
  console.log('Testing National ID document and number mapping during registration...');

  const testPhone = `+2519${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testEmail = `national_id_test_${Date.now()}@tebeka.et`;
  const barNum = `BAR-ETH-${Math.floor(1000 + Math.random() * 9000)}`;
  const natIdNum = `ETH-NATID-${Math.floor(100000 + Math.random() * 900000)}`;

  const user = await prisma.user.create({
    data: {
      phone: testPhone,
      email: testEmail,
      name: 'National ID Test Attorney',
      role: 'ATTORNEY',
      status: 'ACTIVE',
      attorneyProfile: {
        create: {
          barRegistrationNumber: barNum,
          barAdmissionYear: 2020,
          nationalIdNumber: natIdNum,
          nationalIdDocumentUrl: `credentials/national_id_${Date.now()}.pdf`,
          licenseBookUrl: `credentials/license_${Date.now()}.pdf`,
          verificationStatus: 'SUBMITTED',
          status: 'DRAFT',
          profileCompleteness: 70,
        }
      }
    },
    include: {
      attorneyProfile: {
        include: { credentials: { include: { documents: true } } }
      }
    }
  });

  const profile = user.attorneyProfile;
  console.log('Created Attorney Profile:');
  console.log(`- Profile ID: ${profile.id}`);
  console.log(`- National ID Number: ${profile.nationalIdNumber}`);
  console.log(`- National ID Document URL: ${profile.nationalIdDocumentUrl}`);
  console.log(`- License Book URL: ${profile.licenseBookUrl}`);

  if (profile.nationalIdNumber !== natIdNum || !profile.nationalIdDocumentUrl) {
    throw new Error('FAILED: National ID number or document URL was not saved properly!');
  }

  // Cleanup
  await prisma.attorneyProfile.delete({ where: { id: profile.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('✅ ALL NATIONAL ID TESTS PASSED SUCCESSFULLY!');
  await prisma.$disconnect();
}

testNationalIdFlow().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
