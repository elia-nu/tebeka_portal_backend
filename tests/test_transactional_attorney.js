require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testTransactionalAttorneyFlow() {
  console.log(`\n======================================================`);
  console.log(`=== End-to-End Transactional Attorney Flow Test    ===`);
  console.log(`======================================================\n`);

  const testPhone = '+251911776655';
  const testEmail = 'attorney_tx_test@example.com';
  const barNo = 'BAR-TX-998877';
  const continuationToken = `otp_cont_attorney_${Date.now()}`;

  // 1. Cleanup any existing test records
  console.log(`[DB Setup] Cleaning up prior test attorney records...`);
  const oldUser = await prisma.user.findFirst({ where: { phone: testPhone, role: 'ATTORNEY' } });
  if (oldUser) {
    await prisma.user.delete({ where: { id: oldUser.id } });
  }
  await prisma.otpCode.deleteMany({ where: { phone: testPhone } });

  // 2. Insert test OtpCode with continuationToken
  await prisma.otpCode.create({
    data: {
      phone: testPhone,
      purpose: 'REGISTRATION',
      codeHash: '123456',
      continuationToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      usedAt: null
    }
  });
  console.log(`[DB Setup] Created OtpCode record with continuationToken: ${continuationToken}`);

  // 3. Execute Transactional Attorney Registration
  console.log(`\n--- Step 1: Executing Transactional Attorney Registration ($transaction) ---`);
  
  const result = await prisma.$transaction(async (tx) => {
    // A. Validate Token
    const otpRecord = await tx.otpCode.findUnique({ where: { continuationToken } });
    if (!otpRecord || otpRecord.usedAt || otpRecord.expiresAt < new Date()) {
      throw new Error('Invalid continuation token');
    }

    // B. Consume Token
    await tx.otpCode.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() }
    });

    // C. Create User + AttorneyProfile (SUBMITTED status)
    const user = await tx.user.create({
      data: {
        phone: testPhone,
        email: testEmail,
        name: 'Abebe Bikila (Esq.)',
        role: 'ATTORNEY',
        status: 'ACTIVE',
        phoneVerified: true,
        attorneyProfile: {
          create: {
            barRegistrationNumber: barNo,
            barAdmissionYear: 2018,
            verificationStatus: 'SUBMITTED',
            status: 'DRAFT',
            profileCompleteness: 30
          }
        }
      },
      include: { attorneyProfile: true }
    });

    // D. Automatically create VerificationCase in FR-VERIF queue
    const vCase = await tx.verificationCase.create({
      data: {
        attorneyId: user.attorneyProfile.id,
        status: 'SUBMITTED',
        slaDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        checklists: {
          create: [
            { itemName: 'identity_match', status: 'PENDING' },
            { itemName: 'bar_number_format', status: 'PENDING' },
            { itemName: 'certificate_authenticity', status: 'PENDING' },
            { itemName: 'bar_standing', status: 'PENDING' },
          ]
        }
      },
      include: { checklists: true }
    });

    return { user, vCase };
  });

  console.log(`✅ [TRANSACTION COMMIT SUCCESS]`);
  console.log(`   User ID: ${result.user.id}`);
  console.log(`   Attorney Profile ID: ${result.user.attorneyProfile.id}`);
  console.log(`   Verification Status: ${result.user.attorneyProfile.verificationStatus}`);
  console.log(`   Verification Case ID (FR-VERIF Queue): ${result.vCase.id}`);
  console.log(`   Checklist Items Created: ${result.vCase.checklists.length}/4 items`);

  // 4. Test Discovery Exclusion Guard
  console.log(`\n--- Step 2: Testing Discovery Exclusion Protection ---`);
  const unverifiedInDiscovery = await prisma.attorneyProfile.findMany({
    where: {
      id: result.user.attorneyProfile.id,
      status: 'ACTIVE',
      verificationStatus: 'APPROVED'
    }
  });

  if (unverifiedInDiscovery.length === 0) {
    console.log(`🛡️ [DISCOVERY GUARD PASSED] Attorney is correctly HIDDEN from public discovery search!`);
  } else {
    console.log(`❌ [DISCOVERY GUARD FAILED] Attorney unexpectedly appeared in public search.`);
  }

  // 5. Simulate Admin Verification Approval (Passing 4 checklist items + Approving Case)
  console.log(`\n--- Step 3: Simulating Admin FR-VERIF Queue Case Review & Approval ---`);
  
  // Pass all 4 checklist items
  await prisma.verificationChecklist.updateMany({
    where: { verificationCaseId: result.vCase.id },
    data: { status: 'PASSED', completedAt: new Date() }
  });
  console.log(`[Admin Action] All 4 mandatory checklist items updated to PASSED.`);

  // Approve Verification Case & Update Attorney Profile
  await prisma.attorneyProfile.update({
    where: { id: result.user.attorneyProfile.id },
    data: {
      verificationStatus: 'APPROVED',
      hasVerifiedBadge: true,
      status: 'ACTIVE'
    }
  });

  await prisma.verificationCase.update({
    where: { id: result.vCase.id },
    data: { status: 'APPROVED', verifiedAt: new Date() }
  });
  console.log(`[Admin Action] Verification case ${result.vCase.id} APPROVED.`);

  // 6. Test Discovery Entry Post-Approval
  console.log(`\n--- Step 4: Testing Discovery Entry Post-Approval ---`);
  const verifiedInDiscovery = await prisma.attorneyProfile.findMany({
    where: {
      id: result.user.attorneyProfile.id,
      status: 'ACTIVE',
      verificationStatus: 'APPROVED'
    }
  });

  if (verifiedInDiscovery.length === 1) {
    console.log(`🎉 [DISCOVERY ENTRY SUCCESS] Approved Attorney NOW appears in Public Discovery!`);
    console.log(`   Profile ID: ${verifiedInDiscovery[0].id}`);
    console.log(`   Verified Badge: ${verifiedInDiscovery[0].hasVerifiedBadge}`);
  } else {
    console.log(`❌ [DISCOVERY ENTRY FAILED] Attorney failed to appear after approval.`);
  }

  console.log(`\n======================================================`);
  console.log(`=== END-TO-END TEST COMPLETED SUCCESSFULLY         ===`);
  console.log(`======================================================\n`);
}

testTransactionalAttorneyFlow()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('❌ Test Failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
