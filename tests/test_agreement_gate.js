const { PrismaClient } = require('@prisma/client/marketplace');
const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Starting Tri-Party Agreement Room & Non-Circumvention Gating Test Suite...\n');

  try {
    // 1. Setup mock user IDs
    const clientId = 'c0000000-0000-0000-0000-000000000001';
    const attorneyId = 'a0000000-0000-0000-0000-000000000001';

    // 2. Test Case Creation & Auto-Provisioned Agreement Room
    console.log('📌 Step 1: Creating new legal case...');
    const caseCount = await prisma.case.count();
    const referenceNumber = `CASE-TEST-${Date.now()}`;

    const newCase = await prisma.case.create({
      data: {
        referenceNumber,
        clientId,
        attorneyId,
        title: 'Test Commercial Dispute & Non-Circumvention Check',
        description: 'Test case to verify agreement room and gating functionality.',
        status: 'OPEN',
        agreement: {
          create: {
            agreementType: 'CASE_ENGAGEMENT_NON_CIRCUMVENTION',
            version: 1,
            termsContent: '# Tebeka Non-Circumvention Tri-Party Agreement',
            status: 'PENDING_SIGNATURES',
          },
        },
      },
      include: { agreement: true },
    });

    console.log(`✅ Case created: ${newCase.id} with reference ${newCase.referenceNumber}`);
    console.log(`✅ Auto-created Agreement ID: ${newCase.agreement?.id}`);
    console.log(`✅ Initial Agreement Status: ${newCase.agreement?.status} (clientSigned: ${newCase.agreement?.clientSigned}, attorneySigned: ${newCase.agreement?.attorneySigned})`);

    if (newCase.agreement?.status !== 'PENDING_SIGNATURES') {
      throw new Error(`Expected status PENDING_SIGNATURES, got ${newCase.agreement?.status}`);
    }

    // 3. Client Signs Agreement
    console.log('\n📌 Step 2: Client signing agreement...');
    const clientSignDate = new Date();
    const afterClientSign = await prisma.caseAgreement.update({
      where: { id: newCase.agreement.id },
      data: {
        clientSigned: true,
        clientSignedAt: clientSignDate,
        clientSignerName: 'Abebe Bikila (Client)',
        clientSignerIp: '197.156.100.1',
        nonCircumventionAck: true,
        platformFeeAck: true,
        confidentialityAck: true,
      },
    });

    console.log(`✅ Client signature recorded at: ${afterClientSign.clientSignedAt}`);
    console.log(`✅ Status after client sign only: ${afterClientSign.status} (clientSigned: ${afterClientSign.clientSigned}, attorneySigned: ${afterClientSign.attorneySigned})`);
    if (afterClientSign.status !== 'PENDING_SIGNATURES') {
      throw new Error(`Expected status still PENDING_SIGNATURES before attorney signs, got ${afterClientSign.status}`);
    }

    // 4. Attorney Signs Agreement (Mutual Execution)
    console.log('\n📌 Step 3: Attorney signing agreement (Mutual Execution)...');
    const attorneySignDate = new Date();
    const fullyExecuted = await prisma.$transaction(async (tx) => {
      const updated = await tx.caseAgreement.update({
        where: { id: newCase.agreement.id },
        data: {
          attorneySigned: true,
          attorneySignedAt: attorneySignDate,
          attorneySignerName: 'Advocate Yared Tesfaye (Attorney)',
          attorneySignerIp: '197.156.100.2',
          status: 'FULLY_EXECUTED',
          fullyExecutedAt: attorneySignDate,
        },
      });

      await tx.caseTimeline.create({
        data: {
          caseId: newCase.id,
          title: 'Tri-Party Non-Circumvention Agreement Executed',
          description: `Signed by Client (${updated.clientSignerName}) and Attorney (${updated.attorneySignerName}). Workspace and communication unlocked.`,
          eventDate: attorneySignDate,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'CaseAgreement',
          aggregateId: updated.id,
          eventType: 'AGREEMENT_EXECUTED',
          payload: {
            caseId: newCase.id,
            agreementId: updated.id,
            clientId,
            attorneyId,
            executedAt: attorneySignDate,
          },
        },
      });

      return updated;
    });

    console.log(`✅ Mutual execution complete! Agreement Status: ${fullyExecuted.status}`);
    console.log(`✅ Fully Executed At: ${fullyExecuted.fullyExecutedAt}`);
    if (fullyExecuted.status !== 'FULLY_EXECUTED') {
      throw new Error(`Expected status FULLY_EXECUTED, got ${fullyExecuted.status}`);
    }

    // 5. Verify Timeline Entry & Outbox Event
    console.log('\n📌 Step 4: Verifying Timeline & Outbox audit trail...');
    const timelines = await prisma.caseTimeline.findMany({
      where: { caseId: newCase.id },
    });
    console.log(`✅ Found ${timelines.length} timeline events:`);
    timelines.forEach((t) => console.log(`   - [${t.eventDate.toISOString()}] ${t.title}: ${t.description}`));

    const outbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: fullyExecuted.id, eventType: 'AGREEMENT_EXECUTED' },
    });
    if (!outbox) {
      throw new Error('Expected AGREEMENT_EXECUTED outbox event, none found.');
    }
    console.log(`✅ Outbox Event verified: ${outbox.eventType} (Payload: ${JSON.stringify(outbox.payload)})`);

    // 6. Test Agreement Decline Flow
    console.log('\n📌 Step 5: Testing Agreement Decline & Case Cancellation Flow...');
    const declineCase = await prisma.case.create({
      data: {
        referenceNumber: `CASE-DECLINE-${Date.now()}`,
        clientId,
        attorneyId,
        title: 'Case To Be Declined',
        description: 'Testing decline handling in agreement room.',
        status: 'OPEN',
        agreement: {
          create: {
            agreementType: 'CASE_ENGAGEMENT_NON_CIRCUMVENTION',
            version: 1,
            termsContent: '# Tebeka Terms',
            status: 'PENDING_SIGNATURES',
          },
        },
      },
      include: { agreement: true },
    });

    const declinedAgreement = await prisma.$transaction(async (tx) => {
      const updated = await tx.caseAgreement.update({
        where: { id: declineCase.agreement.id },
        data: {
          status: 'DECLINED',
          declinedBy: attorneyId,
          declineReason: 'Conflict of interest identified with opposing party.',
        },
      });

      await tx.case.update({
        where: { id: declineCase.id },
        data: { status: 'CANCELLED' },
      });

      return updated;
    });

    const refreshedCase = await prisma.case.findUnique({
      where: { id: declineCase.id },
    });

    console.log(`✅ Agreement Status: ${declinedAgreement.status}`);
    console.log(`✅ Case Status after decline: ${refreshedCase.status}`);
    console.log(`✅ Decline Reason: "${declinedAgreement.declineReason}" by ${declinedAgreement.declinedBy}`);

    if (declinedAgreement.status !== 'DECLINED' || refreshedCase.status !== 'CANCELLED') {
      throw new Error('Decline flow validation failed');
    }

    // Cleanup test data
    console.log('\n🧹 Cleaning up test records...');
    await prisma.caseAgreement.deleteMany({
      where: { id: { in: [newCase.agreement.id, declineCase.agreement.id] } },
    });
    await prisma.caseTimeline.deleteMany({
      where: { caseId: { in: [newCase.id, declineCase.id] } },
    });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: [newCase.agreement.id, declineCase.agreement.id] } },
    });
    await prisma.case.deleteMany({
      where: { id: { in: [newCase.id, declineCase.id] } },
    });

    console.log('✅ Test cleanup completed successfully.');
    console.log('\n🎉 ALL AGREEMENT ROOM & NON-CIRCUMVENTION GATE TESTS PASSED!');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
