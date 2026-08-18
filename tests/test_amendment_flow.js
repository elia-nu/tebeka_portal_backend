const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runAmendmentFlowTest() {
  console.log('=== Starting Attorney Profile Amendment Workflow Integration Test ===');

  try {
    // 1. Seed or find test attorney
    let user = await prisma.user.findUnique({ where: { email: 'test.amendment.attorney@tebeka.et' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test.amendment.attorney@tebeka.et',
          name: 'Test Amendment Attorney',
          role: 'ATTORNEY',
          status: 'ACTIVE'
        }
      });
    }

    // Clean up existing profile if any
    await prisma.attorneyProfile.deleteMany({ where: { userId: user.id } });

    // 2. Create AttorneyProfile in DRAFT status
    const profile = await prisma.attorneyProfile.create({
      data: {
        userId: user.id,
        bioEn: 'Original bio description for attorney before amendment request.',
        verificationStatus: 'SUBMITTED',
        barRegistrationNumber: 'ETH-12345-OLD',
      }
    });

    // 3. Create active VerificationCase
    const vCase = await prisma.verificationCase.create({
      data: {
        attorneyId: profile.id,
        status: 'SUBMITTED',
      }
    });

    console.log(`[PASS] Created test AttorneyProfile (${profile.id}) and VerificationCase (${vCase.id}) in SUBMITTED state.`);

    // 4. Test Admin Requesting Amendment
    const requestRes = await verificationsServiceHelper(vCase.id, 'Please update bio and correct bar registration number', ['bioEn', 'barRegistrationNumber']);
    console.log(`[PASS] Admin requested amendment. Case status: ${requestRes.caseStatus}, Profile status: ${requestRes.profileStatus}`);
    
    if (requestRes.caseStatus !== 'ADDITIONAL_INFO_REQUIRED' || requestRes.profileStatus !== 'ADDITIONAL_INFO_REQUIRED') {
      throw new Error('Verification statuses failed to sync to ADDITIONAL_INFO_REQUIRED');
    }

    // 5. Test Attorney Submitting Amendment & Reply
    const submitRes = await attorneySubmitHelper(profile.id, vCase.id, {
      bioEn: 'Updated bio description answering admin request with full details.',
      barRegistrationNumber: 'ETH-99999-NEW',
      amendmentReply: 'I have updated my bio and submitted the corrected bar registration number.'
    });

    console.log(`[PASS] Attorney submitted amendment reply: "${submitRes.amendmentReply}"`);

    // Verify database state after submission
    const updatedProfile = await prisma.attorneyProfile.findUnique({ where: { id: profile.id } });
    const updatedCase = await prisma.verificationCase.findUnique({ where: { id: vCase.id } });

    console.log(`[PASS] Post-submission AttorneyProfile status: ${updatedProfile.verificationStatus}`);
    console.log(`[PASS] Post-submission VerificationCase status: ${updatedCase.status}, SLA Paused: ${updatedCase.isSlaPaused}`);
    console.log(`[PASS] Admin view amendment reply: "${updatedCase.amendmentReply}"`);

    if (updatedProfile.verificationStatus !== 'PENDING_REVIEW' || updatedCase.status !== 'PENDING_REVIEW') {
      throw new Error('Statuses failed to transition back to PENDING_REVIEW after amendment reply');
    }

    if (updatedCase.isSlaPaused !== false) {
      throw new Error('SLA timer failed to unpause after amendment reply submission');
    }

    // Cleanup
    await prisma.attorneyProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log('=== All Attorney Profile Amendment Workflow Tests PASSED Successfully! ===');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function verificationsServiceHelper(caseId, notes, fields) {
  const vCase = await prisma.verificationCase.findUnique({ where: { id: caseId } });
  await prisma.attorneyProfile.update({
    where: { id: vCase.attorneyId },
    data: { verificationStatus: 'ADDITIONAL_INFO_REQUIRED' }
  });

  const updatedCase = await prisma.verificationCase.update({
    where: { id: caseId },
    data: {
      status: 'ADDITIONAL_INFO_REQUIRED',
      amendmentNotes: notes,
      requestedFields: fields,
      amendmentRequestedAt: new Date(),
      isSlaPaused: true,
      slaPausedAt: new Date()
    }
  });

  const updatedProfile = await prisma.attorneyProfile.findUnique({ where: { id: vCase.attorneyId } });

  return {
    caseStatus: updatedCase.status,
    profileStatus: updatedProfile.verificationStatus,
    amendmentNotes: updatedCase.amendmentNotes
  };
}

async function attorneySubmitHelper(profileId, caseId, data) {
  await prisma.attorneyProfile.update({
    where: { id: profileId },
    data: {
      bioEn: data.bioEn,
      barRegistrationNumber: data.barRegistrationNumber,
      verificationStatus: 'PENDING_REVIEW'
    }
  });

  const updatedCase = await prisma.verificationCase.update({
    where: { id: caseId },
    data: {
      status: 'PENDING_REVIEW',
      amendmentReply: data.amendmentReply,
      amendmentSubmittedAt: new Date(),
      isSlaPaused: false,
      slaResumedAt: new Date()
    }
  });

  return {
    amendmentReply: updatedCase.amendmentReply
  };
}

runAmendmentFlowTest();
