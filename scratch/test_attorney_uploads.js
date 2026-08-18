const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('--- STARTING ATTORNEY VERIFICATION FILE UPLOAD TEST ---');

  // 1. Create a dummy test attorney user & profile
  const testPhone = `+2519${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testEmail = `test_attorney_${Date.now()}@tebeka.et`;
  const barNum = `BAR-ETH-${Math.floor(1000 + Math.random() * 9000)}`;

  console.log(`Creating test attorney user with phone: ${testPhone}, barNum: ${barNum}`);

  const user = await prisma.user.create({
    data: {
      phone: testPhone,
      email: testEmail,
      name: 'Test Attorney Verification',
      role: 'ATTORNEY',
      status: 'ACTIVE',
      attorneyProfile: {
        create: {
          barRegistrationNumber: barNum,
          verificationStatus: 'SUBMITTED',
          status: 'DRAFT',
          profileCompleteness: 30,
        }
      }
    },
    include: { attorneyProfile: true }
  });

  const profileId = user.attorneyProfile.id;
  console.log(`Created Attorney Profile ID: ${profileId}`);

  // 2. Simulate document upload 1: BAR_LICENSE
  const cred1 = await prisma.credential.create({
    data: {
      attorneyId: profileId,
      credentialType: 'BAR_LICENSE',
      issuer: 'Ministry of Justice',
      credentialNumber: barNum,
      verificationStatus: 'SUBMITTED',
      documents: {
        create: [
          {
            fileKey: `credentials/${profileId}/bar_license.pdf`,
            mimeType: 'application/pdf',
            size: 524288,
          }
        ]
      }
    },
    include: { documents: true }
  });
  console.log('Uploaded BAR_LICENSE document successfully:', cred1);

  // 3. Simulate document upload 2: NATIONAL_ID
  const cred2 = await prisma.credential.create({
    data: {
      attorneyId: profileId,
      credentialType: 'NATIONAL_ID',
      issuer: 'National ID Program',
      credentialNumber: `ID-${Date.now()}`,
      verificationStatus: 'SUBMITTED',
      documents: {
        create: [
          {
            fileKey: `credentials/${profileId}/national_id.jpg`,
            mimeType: 'image/jpeg',
            size: 204800,
          }
        ]
      }
    },
    include: { documents: true }
  });
  console.log('Uploaded NATIONAL_ID document successfully:', cred2);

  // 4. Update profile URLs
  await prisma.attorneyProfile.update({
    where: { id: profileId },
    data: {
      licenseBookUrl: `credentials/${profileId}/bar_license.pdf`,
      nationalIdDocumentUrl: `credentials/${profileId}/national_id.jpg`,
      profileCompleteness: 80
    }
  });

  // 5. Query stored credentials back
  const allCredentials = await prisma.credential.findMany({
    where: { attorneyId: profileId },
    include: { documents: true }
  });

  console.log(`Fetched ${allCredentials.length} credential containers from DB for attorney.`);
  console.log(JSON.stringify(allCredentials, null, 2));

  // Clean up test records
  await prisma.credentialDocument.deleteMany({ where: { credentialId: { in: allCredentials.map(c => c.id) } } });
  await prisma.credential.deleteMany({ where: { attorneyId: profileId } });
  await prisma.attorneyProfile.delete({ where: { id: profileId } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('--- TEST COMPLETED SUCCESSFULLY & CLEANED UP ---');
  await prisma.$disconnect();
}

runTest().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
