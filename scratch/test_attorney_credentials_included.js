const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCredentialsInProfile() {
  const profile = await prisma.attorneyProfile.findFirst({
    include: {
      user: true,
      educations: true,
      guardedChanges: true,
      verificationCases: true,
      credentials: { include: { documents: true } }
    }
  });

  if (!profile) {
    console.log('No attorney profile found in DB to test.');
    await prisma.$disconnect();
    return;
  }

  console.log('Fetched Attorney Profile with credentials successfully:');
  console.log(`Profile ID: ${profile.id}`);
  console.log(`Credentials Count: ${profile.credentials ? profile.credentials.length : 0}`);
  console.log(JSON.stringify(profile, null, 2));

  await prisma.$disconnect();
}

testCredentialsInProfile().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
