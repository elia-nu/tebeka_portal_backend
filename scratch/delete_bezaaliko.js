const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteBezaalikoUser() {
  console.log('Searching for user matching bezaaliko in DB...');

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'bezaaliko', mode: 'insensitive' } },
        { name: { contains: 'bezaaliko', mode: 'insensitive' } }
      ]
    },
    include: {
      attorneyProfile: true
    }
  });

  if (users.length === 0) {
    console.log('No user matching "bezaaliko" found in DB.');
    await prisma.$disconnect();
    return;
  }

  for (const user of users) {
    console.log(`Found user: ID=${user.id}, Email=${user.email}, Phone=${user.phone}, Name=${user.name}`);

    if (user.attorneyProfile) {
      const attorneyId = user.attorneyProfile.id;
      console.log(`Deleting attorney profile relations for attorneyId: ${attorneyId}`);

      // Delete VerificationCase check list items & cases
      const cases = await prisma.verificationCase.findMany({ where: { attorneyId } });
      for (const vc of cases) {
        await prisma.verificationChecklist.deleteMany({ where: { verificationCaseId: vc.id } });
      }
      await prisma.verificationCase.deleteMany({ where: { attorneyId } });

      // Delete Credential document items & credentials
      const creds = await prisma.credential.findMany({ where: { attorneyId } });
      for (const c of creds) {
        await prisma.credentialDocument.deleteMany({ where: { credentialId: c.id } });
      }
      await prisma.credential.deleteMany({ where: { attorneyId } });

      // Delete GuardedChanges & Educations
      await prisma.guardedChange.deleteMany({ where: { attorneyId } });
      await prisma.attorneyEducation.deleteMany({ where: { attorneyId } });

      // Delete Attorney Profile
      await prisma.attorneyProfile.delete({ where: { id: attorneyId } });
      console.log(`Deleted AttorneyProfile: ${attorneyId}`);
    }

    // Delete Sessions, Accounts, UserPreferences, and Verification records
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.userPreference.deleteMany({ where: { userId: user.id } });
    await prisma.verification.deleteMany({ where: { identifier: user.email } });

    // Delete User
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Successfully deleted User: ${user.id} (${user.email})`);
  }

  // Also clean up any lingering verifications for bezaaliko@gmail.com
  await prisma.verification.deleteMany({
    where: { identifier: { contains: 'bezaaliko', mode: 'insensitive' } }
  });

  console.log('✅ ALL RECORDS FOR BEZAALIKO REMOVED FROM DATABASE CLEANLY!');
  await prisma.$disconnect();
}

deleteBezaalikoUser().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
