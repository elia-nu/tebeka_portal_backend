const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('🧪 Starting Verification CaseType & SLA Report Integration Test...\n');

  // 1. Clean up or setup test attorney
  const testEmail = `test.attorney.${Date.now()}@tebekalaw.et`;
  const testPhone = `+251911${Math.floor(100000 + Math.random() * 900000)}`;
  const barNumber = `BAR-TEST-${Date.now()}`;

  console.log(`1. Creating Test Attorney: ${testEmail}, ${testPhone}`);
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      phone: testPhone,
      name: 'Dr. Test Attorney',
      role: 'ATTORNEY',
      status: 'ACTIVE',
      attorneyProfile: {
        create: {
          licenseNumber: barNumber,
          barRegistrationNumber: barNumber,
          fullName: 'Dr. Test Attorney',
          city: 'Addis Ababa',
          feeBand: 'STANDARD',
          consultationFee: 2000,
          verificationStatus: 'APPROVED',
          hasVerifiedBadge: true,
          credentialClaimsMatch: true,
          profileCompleteness: 85,
          status: 'ACTIVE'
        }
      }
    },
    include: { attorneyProfile: true }
  });

  const attorneyId = user.attorneyProfile.id;
  console.log(`   Created Attorney Profile ID: ${attorneyId}`);

  // 2. Create Initial Case (caseType: NEW_ATTORNEY)
  console.log('\n2. Creating Initial NEW_ATTORNEY VerificationCase...');
  const newAttorneyCase = await prisma.verificationCase.create({
    data: {
      attorneyId,
      caseType: 'NEW_ATTORNEY',
      status: 'APPROVED',
      verifiedAt: new Date(),
      slaDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      checklists: {
        create: [
          { itemName: 'identity_match', status: 'PASSED' },
          { itemName: 'bar_number_format', status: 'PASSED' },
          { itemName: 'certificate_authenticity', status: 'PASSED' },
          { itemName: 'bar_standing', status: 'PASSED' }
        ]
      }
    }
  });
  console.log(`   [PASS] Created Case ID: ${newAttorneyCase.id}, CaseType: ${newAttorneyCase.caseType}, Status: ${newAttorneyCase.status}`);

  // 3. Create a Breached Case for SLA testing
  console.log('\n3. Creating Overdue / Breached Case (to test SLA report breach counter)...');
  const breachedCase = await prisma.verificationCase.create({
    data: {
      attorneyId,
      caseType: 'NEW_ATTORNEY',
      status: 'SUBMITTED',
      slaDueDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h in past
      checklists: {
        create: [
          { itemName: 'identity_match', status: 'PENDING' }
        ]
      }
    }
  });
  console.log(`   [PASS] Breached Case ID: ${breachedCase.id}, SLA Due: ${breachedCase.slaDueDate}`);

  // 4. Test Guarded Profile Change Workflow (caseType: GUARDED_CHANGE)
  console.log('\n4. Simulating Guarded Profile Change Submission (License # Change)...');
  const guardedSlaDueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const guardedCase = await prisma.verificationCase.create({
    data: {
      attorneyId,
      caseType: 'GUARDED_CHANGE',
      status: 'SUBMITTED',
      slaDueDate: guardedSlaDueDate,
      checklists: {
        create: [
          { itemName: 'guarded_field_accuracy', status: 'PENDING' },
          { itemName: 'document_proof_verified', status: 'PENDING' }
        ]
      }
    }
  });

  const guardedChange = await prisma.guardedChange.create({
    data: {
      attorneyId,
      field: 'licenseNumber',
      oldValue: barNumber,
      newValue: `${barNumber}-UPDATED`,
      verificationCaseId: guardedCase.id,
      status: 'PENDING'
    }
  });
  console.log(`   [PASS] Created GuardedChange ID: ${guardedChange.id}, Linked Case: ${guardedChange.verificationCaseId}, CaseType: ${guardedCase.caseType}`);

  // 5. Query cases by caseType filter
  console.log('\n5. Testing Query by caseType...');
  const guardedCases = await prisma.verificationCase.findMany({
    where: { caseType: 'GUARDED_CHANGE' }
  });
  console.log(`   [PASS] Found ${guardedCases.length} GUARDED_CHANGE cases in queue.`);
  if (!guardedCases.some(c => c.id === guardedCase.id)) {
    throw new Error('Expected created guardedCase to be in query result');
  }

  // 6. Test SLA Report Calculation
  console.log('\n6. Testing SLA Report Calculation...');
  const activeCases = await prisma.verificationCase.findMany({
    where: { status: { in: ['SUBMITTED', 'PENDING_REVIEW', 'ADDITIONAL_INFO_REQUIRED'] } },
    include: { attorney: { select: { id: true, fullName: true } } }
  });

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  let totalActiveCases = activeCases.length;
  let totalBreached = 0;
  let atRiskCases = 0;
  let pausedCases = 0;
  const breachedCasesList = [];
  const byCaseType = {
    NEW_ATTORNEY: { active: 0, breached: 0, atRisk: 0, paused: 0 },
    GUARDED_CHANGE: { active: 0, breached: 0, atRisk: 0, paused: 0 },
    ANNUAL: { active: 0, breached: 0, atRisk: 0, paused: 0 },
    FRAUD_REVIEW: { active: 0, breached: 0, atRisk: 0, paused: 0 },
  };

  for (const c of activeCases) {
    const type = c.caseType || 'NEW_ATTORNEY';
    if (!byCaseType[type]) byCaseType[type] = { active: 0, breached: 0, atRisk: 0, paused: 0 };
    byCaseType[type].active++;

    if (c.isSlaPaused) {
      pausedCases++;
      byCaseType[type].paused++;
      continue;
    }

    if (c.slaDueDate) {
      const dueDate = new Date(c.slaDueDate);
      if (dueDate < now) {
        totalBreached++;
        byCaseType[type].breached++;
        breachedCasesList.push(c.id);
      } else if (dueDate <= in24h) {
        atRiskCases++;
        byCaseType[type].atRisk++;
      }
    }
  }

  const complianceRate = totalActiveCases > 0
    ? Number((((totalActiveCases - totalBreached) / totalActiveCases) * 100).toFixed(1))
    : 100.0;

  console.log('   SLA Report Summary:');
  console.log(`     Total Active Cases: ${totalActiveCases}`);
  console.log(`     Total Breached: ${totalBreached}`);
  console.log(`     At Risk (<24h): ${atRiskCases}`);
  console.log(`     Paused: ${pausedCases}`);
  console.log(`     Compliance Rate: ${complianceRate}%`);
  console.log(`     By CaseType:`, JSON.stringify(byCaseType, null, 2));

  if (totalBreached < 1) {
    throw new Error('SLA report should have captured at least 1 breached case');
  }
  if (!breachedCasesList.includes(breachedCase.id)) {
    throw new Error('Expected created breachedCase to be in breached list');
  }

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

run()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
