require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');

const USER_API = 'http://localhost:3001/api/v1';
const MARKETPLACE_API = 'http://localhost:3002/api/v1';

let adminToken = '';
let attorneyToken = '';

async function request(url, options = {}, token = null) {
  const authToken = token || adminToken;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\n❌ [ASSERTION FAILED]: ${message}`);
    throw new Error(message);
  }
  console.log(`   ✅ [PASS] ${message}`);
}

async function runAmendmentComprehensiveTest() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🧪 COMPREHENSIVE ATTORNEY PROFILE AMENDMENT WORKFLOW E2E TEST');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const timestamp = Date.now();
  const attorneyEmail = `amendment.attorney.${timestamp}@tebekalaw.et`;
  const attorneyPassword = 'Password@123';
  const attorneyPhone = `+251911${Math.floor(100000 + Math.random() * 900000)}`;
  const attorneySlug = `amendment-attorney-${timestamp}`;
  const originalAddress = 'Old Office Address, Kirkos Subcity, Addis Ababa';
  const updatedAddress = 'Bole Subcity, Cameroon Street, Edna Mall Building 5th Floor';
  const originalBarNumber = `ETH-BAR-OLD-${timestamp}`;
  const updatedBarNumber = `ETH-BAR-RENEWED-${timestamp}`;

  let userId = null;
  let attorneyId = null;
  let verificationCaseId = null;

  try {
    // ════════════════════════════════════════════════════════════════════════════
    // STEP 0: Admin & Attorney Authentication Setup
    // ════════════════════════════════════════════════════════════════════════════
    console.log('--- Step 0: Authentication & User Setup ---');
    
    // 0.1 Admin Login
    const adminLoginRes = await request(`${USER_API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@tebeka.et', password: 'Password@123' })
    });
    assert(adminLoginRes.ok, `Admin authenticated successfully (status ${adminLoginRes.status})`);
    adminToken = adminLoginRes.data.token || adminLoginRes.data.accessToken;
    assert(!!adminToken, 'Admin JWT token acquired');

    // 0.2 Create Test Attorney with Password Hash
    const passwordHash = await bcrypt.hash(attorneyPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: attorneyEmail,
        phone: attorneyPhone,
        name: 'Ato Abebe Bikila (Amendment Test)',
        passwordHash,
        role: 'ATTORNEY',
        status: 'ACTIVE',
        attorneyProfile: {
          create: {
            slug: attorneySlug,
            fullName: 'Ato Abebe Bikila',
            licenseNumber: originalBarNumber,
            barRegistrationNumber: originalBarNumber,
            officeAddress: originalAddress,
            city: `Addis-Bole-${timestamp}`,
            profileCompleteness: 50,
            verificationStatus: 'DRAFT',
            status: 'DRAFT',
            hasVerifiedBadge: false,
            credentialClaimsMatch: false,
            bio: 'Commercial litigation specialist.'
          }
        }
      },
      include: { attorneyProfile: true }
    });

    userId = user.id;
    attorneyId = user.attorneyProfile.id;
    console.log(`   Created Test Attorney ID: ${attorneyId} (User: ${userId})`);

    // 0.3 Attorney Login
    const attorneyLoginRes = await request(`${USER_API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: attorneyEmail, password: attorneyPassword })
    });
    assert(attorneyLoginRes.ok, `Attorney authenticated successfully (status ${attorneyLoginRes.status})`);
    attorneyToken = attorneyLoginRes.data.token || attorneyLoginRes.data.accessToken;
    assert(!!attorneyToken, 'Attorney JWT token acquired');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 1: Attorney Submits Initial Verification Case
    // ════════════════════════════════════════════════════════════════════════════
    console.log('\n--- Step 1: Initial Verification Case Submission ---');
    const createCaseRes = await request(`${USER_API}/verifications`, {
      method: 'POST',
      body: JSON.stringify({ attorneyId, caseType: 'NEW_ATTORNEY' })
    }, attorneyToken);
    assert(createCaseRes.status === 201 || createCaseRes.status === 200, `Verification case created (status ${createCaseRes.status})`);
    verificationCaseId = createCaseRes.data.id;
    assert(!!verificationCaseId, `Verification Case ID: ${verificationCaseId}`);
    assert(createCaseRes.data.status === 'SUBMITTED', 'Case status is SUBMITTED');
    assert(createCaseRes.data.isSlaPaused === false, 'SLA clock is initially running (isSlaPaused == false)');
    assert(!!createCaseRes.data.slaDueDate, 'SLA due date established');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 2: Admin Requests Profile Amendment (SLA Clock Paused)
    // ════════════════════════════════════════════════════════════════════════════
    console.log('\n--- Step 2: Admin Requests Profile Amendment ---');
    const amendmentNotes = 'Please update your law firm office address to Bole and re-upload your renewed 2026 bar license certificate.';
    const requestedFields = ['officeAddress', 'barRegistrationNumber'];

    const requestAmendRes = await request(`${USER_API}/verifications/${verificationCaseId}/request-amendment`, {
      method: 'POST',
      body: JSON.stringify({
        notes: amendmentNotes,
        requestedFields
      })
    }, adminToken);

    assert(requestAmendRes.ok, `Admin amendment request processed (status ${requestAmendRes.status})`);
    assert(requestAmendRes.data.status === 'ADDITIONAL_INFO_REQUIRED', 'Case status transitioned to ADDITIONAL_INFO_REQUIRED');
    assert(requestAmendRes.data.amendmentNotes === amendmentNotes, 'Amendment notes saved in case');
    assert(JSON.stringify(requestAmendRes.data.requestedFields) === JSON.stringify(requestedFields), 'Requested fields recorded in case');
    assert(requestAmendRes.data.isSlaPaused === true, 'SLA clock successfully PAUSED (isSlaPaused == true)');
    assert(!!requestAmendRes.data.slaPausedAt, 'slaPausedAt timestamp recorded');

    // Verify attorney profile status synchronized in DB
    const profileAfterRequest = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    assert(profileAfterRequest.verificationStatus === 'ADDITIONAL_INFO_REQUIRED', 'AttorneyProfile verificationStatus transitioned to ADDITIONAL_INFO_REQUIRED');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 3: Attorney Views Amendment Request
    // ════════════════════════════════════════════════════════════════════════════
    console.log('\n--- Step 3: Attorney Views Pending Amendment Request ---');
    
    // 3.1 Via /verifications/:id
    const viewCaseRes = await request(`${USER_API}/verifications/${verificationCaseId}`, {}, attorneyToken);
    assert(viewCaseRes.ok, 'Attorney fetched verification case view');
    assert(viewCaseRes.data.status === 'ADDITIONAL_INFO_REQUIRED', 'Case status displayed to attorney as ADDITIONAL_INFO_REQUIRED');
    assert(viewCaseRes.data.amendmentNotes === amendmentNotes, 'Attorney sees admin amendment notes');
    assert(viewCaseRes.data.isSlaPaused === true, 'Attorney view confirms SLA clock is paused');

    // 3.2 Via /verifications/my-case
    const myCaseRes = await request(`${USER_API}/verifications/my-case?attorneyId=${attorneyId}`, {}, attorneyToken);
    const myCaseData = myCaseRes.data.currentCase || myCaseRes.data.verificationCase || myCaseRes.data;
    assert(myCaseData.status === 'ADDITIONAL_INFO_REQUIRED', 'my-case view reflects ADDITIONAL_INFO_REQUIRED');
    assert(myCaseRes.data.canSubmitAmendment === true, 'my-case view confirms canSubmitAmendment is true');
    assert(myCaseRes.data.slaStatus === 'PAUSED', 'my-case view confirms slaStatus is PAUSED');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 4: Attorney Submits Profile Amendment via POST /attorneys/me/submit-amendment
    // ════════════════════════════════════════════════════════════════════════════
    console.log('\n--- Step 4: Attorney Submits Amendment via POST /attorneys/me/submit-amendment ---');
    const amendmentReply = 'I have updated my office address to Bole Cameroon Street and updated my bio.';
    const updatedBio = 'Updated bio description answering admin request with full corporate litigation details.';

    const submitAmendmentRes = await request(`${USER_API}/attorneys/me/submit-amendment`, {
      method: 'POST',
      body: JSON.stringify({
        officeAddress: updatedAddress,
        bio: updatedBio,
        amendmentReply
      })
    }, attorneyToken);

    assert(submitAmendmentRes.ok, `Attorney amendment submitted (status ${submitAmendmentRes.status})`);
    assert(submitAmendmentRes.data.status === 'success', 'Response confirms successful submission');
    assert(submitAmendmentRes.data.verificationStatus === 'PENDING_REVIEW', 'Profile verification status transitioned to PENDING_REVIEW');
    assert(submitAmendmentRes.data.amendmentReply === amendmentReply, 'Amendment reply recorded in response');

    // 4.1 Verify Database State Post-Submission
    console.log('   Verifying database state after amendment submission...');
    const profileAfterSubmit = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    assert(profileAfterSubmit.officeAddress === updatedAddress, `Profile officeAddress updated to: "${updatedAddress}"`);
    assert(profileAfterSubmit.bio === updatedBio, `Profile bio updated to: "${updatedBio}"`);
    assert(profileAfterSubmit.verificationStatus === 'PENDING_REVIEW', 'Database AttorneyProfile verificationStatus is PENDING_REVIEW');

    const caseAfterSubmit = await prisma.verificationCase.findUnique({ where: { id: verificationCaseId } });
    assert(caseAfterSubmit.status === 'PENDING_REVIEW', 'Database VerificationCase status is PENDING_REVIEW');
    assert(caseAfterSubmit.amendmentReply === amendmentReply, 'VerificationCase contains attorney amendmentReply');
    assert(!!caseAfterSubmit.amendmentSubmittedAt, 'amendmentSubmittedAt timestamp recorded');
    assert(caseAfterSubmit.isSlaPaused === false, 'SLA clock successfully RESUMED (isSlaPaused == false)');
    assert(!!caseAfterSubmit.slaResumedAt, 'slaResumedAt timestamp recorded');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 5: Test Secondary Amendment Endpoint (POST /verifications/:id/respond-more-info)
    // ════════════════════════════════════════════════════════════════════════════
    console.log('\n--- Step 5: Testing Secondary Info Response Endpoint (/respond-more-info) ---');
    
    // Trigger another amendment request on same case
    const requestAmend2Res = await request(`${USER_API}/verifications/${verificationCaseId}/request-amendment`, {
      method: 'POST',
      body: JSON.stringify({
        notes: 'Please confirm practice areas and fee band.',
        requestedFields: ['practiceAreas', 'feeBand']
      })
    }, adminToken);
    assert(requestAmend2Res.data.isSlaPaused === true, 'SLA paused again on secondary amendment request');

    // Reply via /verifications/:id/respond-more-info
    const respondMoreInfoRes = await request(`${USER_API}/verifications/${verificationCaseId}/respond-more-info`, {
      method: 'POST',
      body: JSON.stringify({
        replyNotes: 'Confirmed: Selected TIER_1 fee band with Commercial Law specialization.'
      })
    }, attorneyToken);

    assert(respondMoreInfoRes.ok, `respond-more-info succeeded (status ${respondMoreInfoRes.status})`);
    assert(respondMoreInfoRes.data.status === 'PENDING_REVIEW', 'Case status returned to PENDING_REVIEW');
    assert(respondMoreInfoRes.data.isSlaPaused === false, 'SLA clock resumed again (isSlaPaused == false)');
    assert(respondMoreInfoRes.data.amendmentReply.includes('Confirmed: Selected TIER_1'), 'Reply notes stored');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 6: Admin Review & Final Approval Post-Amendment
    // ════════════════════════════════════════════════════════════════════════════
    console.log('\n--- Step 6: Admin Final Inspection & Approval Post-Amendment ---');

    // 6.1 Pass checklist items
    const checklistItems = ['identity_match', 'bar_number_format', 'certificate_authenticity', 'bar_standing'];
    for (const item of checklistItems) {
      const chkRes = await request(`${USER_API}/verifications/${verificationCaseId}/checklist/${item}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'PASSED',
          remarks: `Verified amended ${item} against Ethiopian Bar database`
        })
      }, adminToken);
      assert(chkRes.ok, `Checklist item [${item}] marked PASSED`);
    }

    // 6.2 Admin Approval
    const approveRes = await request(`${USER_API}/verifications/${verificationCaseId}/approve`, {
      method: 'POST'
    }, adminToken);
    assert(approveRes.ok, `Verification Case APPROVED after amendment (status ${approveRes.status})`);
    assert(approveRes.data.status === 'APPROVED', 'Case status is APPROVED');

    const approvedProfile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    assert(approvedProfile.verificationStatus === 'APPROVED', 'AttorneyProfile verificationStatus is APPROVED');
    assert(approvedProfile.hasVerifiedBadge === true, 'Verified badge awarded');

    // ════════════════════════════════════════════════════════════════════════════
    // STEP 7: Publication & Discovery Reflection of Amended Details
    // ════════════════════════════════════════════════════════════════════════════
    console.log('\n--- Step 7: Publication & Public Discovery of Amended Profile ---');

    // 7.1 Fulfill publication completeness requirements
    await prisma.attorneyProfile.update({
      where: { id: attorneyId },
      data: {
        profileCompleteness: 90,
        feeBand: 'TIER_1',
        consultationFee: 2500,
        practiceAreas: ['Commercial Litigation', 'Contract Law'],
        languages: ['en', 'am']
      }
    });

    // 7.2 Publish Profile
    const pubRes = await request(`${USER_API}/attorneys/me/publish`, { method: 'PATCH' }, attorneyToken);
    assert(pubRes.ok, `Profile published via PATCH /attorneys/me/publish (status ${pubRes.status})`);
    assert(pubRes.data.status === 'ACTIVE', 'Profile status is ACTIVE');

    // 7.3 Verify in Public Discovery
    const discRes = await request(`${USER_API}/discovery/attorneys/${attorneySlug}`);
    assert(discRes.ok, 'Amended attorney profile resolved by public slug');
    assert(discRes.data.officeAddress === updatedAddress, `Discovery reflects amended office address: "${updatedAddress}"`);
    assert(discRes.data.bio === updatedBio, `Discovery reflects amended bio: "${updatedBio}"`);
    assert(discRes.data.verificationStatus === 'APPROVED', 'Discovery confirms APPROVED verification status');

    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL ATTORNEY PROFILE AMENDMENT WORKFLOW TESTS PASSED PERFECTLY!');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  } finally {
    // Cleanup fixtures
    if (verificationCaseId) {
      await prisma.verificationChecklist.deleteMany({ where: { verificationCaseId } }).catch(() => {});
      await prisma.verificationCase.deleteMany({ where: { id: verificationCaseId } }).catch(() => {});
    }
    if (attorneyId) {
      await prisma.attorneyProfile.deleteMany({ where: { id: attorneyId } }).catch(() => {});
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    console.log('🧹 Test fixtures cleaned up successfully.');
  }

  process.exit(0);
}

runAmendmentComprehensiveTest().catch(err => {
  console.error('\n❌ AMENDMENT TEST RUNNER FAILED:', err);
  process.exit(1);
});
