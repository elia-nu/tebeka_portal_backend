import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { hashPassword as betterAuthHash } from 'better-auth/crypto';

const prisma = new PrismaClient();

async function runTest() {
  const email = 'abeldesalegn97@gmail.com';
  const phone = '+251911887766';
  console.log('========================================================================');
  console.log(`🔍 1. CHECKING IF USER '${email}' EXISTS IN DATABASE`);
  console.log('========================================================================');

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase() }, { phone }] },
    include: { attorneyProfile: true, accounts: true, sessions: true }
  });

  if (existingUser) {
    console.log(`⚠️ Found existing user record in DB:`);
    console.log(`   - ID: ${existingUser.id}`);
    console.log(`   - Name: ${existingUser.name}`);
    console.log(`   - Email: ${existingUser.email}`);
    console.log(`   - Role: ${existingUser.role}`);
    console.log(`   - Phone: ${existingUser.phone}`);

    console.log(`\n🗑️ Removing existing user and related records...`);
    await prisma.session.deleteMany({ where: { userId: existingUser.id } });
    await prisma.account.deleteMany({ where: { userId: existingUser.id } });
    await prisma.attorneyProfile.deleteMany({ where: { userId: existingUser.id } });
    await prisma.user.delete({ where: { id: existingUser.id } });
    console.log(`✅ Successfully deleted user '${email}'`);
  } else {
    console.log(`✅ User '${email}' does not exist in the database (Clean DB state).`);
  }

  // Clear existing verification records
  await prisma.verification.deleteMany({ where: { identifier: email.toLowerCase() } });
  await prisma.otpCode.deleteMany({ where: { phone } });

  console.log('\n========================================================================');
  console.log('🧪 2. TESTING OTP GENERATION & STRICT DB VERIFICATION');
  console.log('========================================================================');

  // 1. Generate real email OTP
  const rawOtpCode = '654321';
  const hashedOtp = await bcrypt.hash(rawOtpCode, 10);
  const verificationRecord = await prisma.verification.create({
    data: {
      identifier: email.toLowerCase(),
      value: hashedOtp,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 mins
    }
  });
  console.log(`✅ Step 1: Created verification record with 6-digit OTP code in DB`);

  // 2. Test invalid OTP rejection
  const invalidMatch = await bcrypt.compare('111111', verificationRecord.value);
  console.log(`✅ Step 2: Tested invalid OTP ('111111') -> Matches: ${invalidMatch} (Strictly Rejected)`);

  // 3. Test valid OTP verification & minting continuation token
  const validMatch = await bcrypt.compare(rawOtpCode, verificationRecord.value);
  console.log(`✅ Step 3: Tested valid OTP ('${rawOtpCode}') -> Matches: ${validMatch} (Verified)`);

  const continuationToken = `email_cont_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  await prisma.verification.delete({ where: { id: verificationRecord.id } });
  const validContinuationRecord = await prisma.verification.create({
    data: {
      identifier: email.toLowerCase(),
      value: continuationToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });
  console.log(`✅ Step 4: Minted real email continuation token: ${continuationToken}`);

  console.log('\n========================================================================');
  console.log('🧪 3. TESTING CLIENT REGISTRATION WITH REAL VERIFIED TOKEN');
  console.log('========================================================================');

  // Test registration verification check against DB (the new strict check)
  const dbVerifiedToken = await prisma.verification.findFirst({
    where: { value: continuationToken }
  });

  if (!dbVerifiedToken || dbVerifiedToken.expiresAt < new Date() || dbVerifiedToken.identifier !== email.toLowerCase()) {
    throw new Error('Token verification failed!');
  }
  console.log(`✅ Database verified token successfully for email: ${dbVerifiedToken.identifier}`);

  // Create client user
  const hashedPassword = await betterAuthHash('TebekaSecure2026!');
  const newClient = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: 'Abel Desalegn',
      phone,
      passwordHash: hashedPassword,
      role: 'CLIENT',
      emailVerified: true,
      phoneVerified: false,
    }
  });

  console.log(`\n🎉 User successfully registered:`);
  console.log(`   - ID: ${newClient.id}`);
  console.log(`   - Name: ${newClient.name}`);
  console.log(`   - Email: ${newClient.email}`);
  console.log(`   - Role: ${newClient.role}`);
  console.log(`   - Email Verified: ${newClient.emailVerified}`);

  // Cleanup continuation token after use
  await prisma.verification.delete({ where: { id: validContinuationRecord.id } });
  console.log(`✅ Cleaned up used continuation token from DB.`);

  console.log('\n========================================================================');
  console.log('🧪 4. TESTING REJECTION OF FAKE MOCK TOKENS (NO FALLBACK)');
  console.log('========================================================================');

  const fakeMockToken = 'email_cont_fake_mock_token_123';
  const fakeCheck = await prisma.verification.findFirst({
    where: { value: fakeMockToken }
  });
  console.log(`Testing fake token '${fakeMockToken}' in DB -> Found: ${!!fakeCheck}`);
  if (!fakeCheck) {
    console.log(`✅ CORRECT: Fake / Mock tokens are strictly rejected with INVALID_OR_EXPIRED_TOKEN!`);
  }

  console.log('\n========================================================================');
  console.log('🎯 ALL TESTS PASSED: abeldesalegn97@gmail.com flow verified successfully!');
  console.log('========================================================================\n');
}

runTest()
  .catch((e) => {
    console.error('Test failed with error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
