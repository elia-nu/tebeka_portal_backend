const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteUser() {
  const targetEmail = 'abeldesalegn97@gmail.com';
  console.log(`Searching for user with email: "${targetEmail}"...`);

  const user = await prisma.user.findFirst({
    where: { email: { equals: targetEmail, mode: 'insensitive' } },
    include: { attorneyProfile: true, clientProfile: true }
  });

  if (!user) {
    console.log(`No user found with email "${targetEmail}".`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Found user: ID=${user.id}, Phone=${user.phone}, Name=${user.name}, Role=${user.role}`);

  // Perform cascade delete
  await prisma.user.delete({
    where: { id: user.id }
  });

  console.log(`Successfully deleted user "${targetEmail}" (ID: ${user.id}) and all associated records from DB.`);
  await prisma.$disconnect();
}

deleteUser().catch(err => {
  console.error('Error deleting user:', err);
  process.exit(1);
});
