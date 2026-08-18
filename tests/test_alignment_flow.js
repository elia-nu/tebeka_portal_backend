require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths/register');
const { generateCaseReferenceNumber, generateConsultationReferenceNumber } = require('../apps/marketplace-service/src/common/utils/reference-generator.util');

async function runAlignmentTest() {
  console.log('=== Starting Complete Model & Functional Requirement Alignment Test ===');

  try {
    // 1. Test Reference Number Generation
    const caseRef = generateCaseReferenceNumber(124);
    const consRef = generateConsultationReferenceNumber(89);
    console.log(`[PASS] Case Reference Number: ${caseRef}`);
    console.log(`[PASS] Consultation Reference Number: ${consRef}`);

    if (!caseRef.startsWith('CASE-') || !consRef.startsWith('CONS-')) {
      throw new Error('Reference number formatting invalid');
    }

    // 2. Verify Reference Sequence Padding
    if (caseRef !== `CASE-${new Date().getFullYear()}-000124` || consRef !== `CONS-${new Date().getFullYear()}-000089`) {
      throw new Error(`Unexpected reference number output: ${caseRef}, ${consRef}`);
    }
    console.log(`[PASS] Reference number sequence padding verified.`);

    // 3. Verify Payment Service Logic
    const { PaymentService } = require('../apps/financial-service/src/modules/payments/payment.service');
    const paymentService = new PaymentService();
    console.log(`[PASS] Financial PaymentService initialized successfully.`);

    // 4. Verify User Service CMS Service Logic
    const { CmsService } = require('../apps/user-service/src/modules/cms/cms.service');
    const cmsService = new CmsService();

    const resources = await cmsService.getPublicLegalResources();
    const blogPosts = await cmsService.getPublicBlogPosts();
    console.log(`[PASS] CMS returned ${resources.length} legal resources and ${blogPosts.length} blog posts.`);

    if (resources.length === 0 || blogPosts.length === 0) {
      throw new Error('CMS failed to return public resources or blog posts');
    }

    // 5. Test Contact Support IP Rate-Limiting
    const ip = '192.168.1.50';
    await cmsService.createPublicContact({ name: 'Test 1', email: 't1@ex.com', subject: 'S1', message: 'M1' }, ip);
    await cmsService.createPublicContact({ name: 'Test 2', email: 't2@ex.com', subject: 'S2', message: 'M2' }, ip);
    await cmsService.createPublicContact({ name: 'Test 3', email: 't3@ex.com', subject: 'S3', message: 'M3' }, ip);
    
    let rateLimited = false;
    try {
      await cmsService.createPublicContact({ name: 'Test 4', email: 't4@ex.com', subject: 'S4', message: 'M4' }, ip);
    } catch (err) {
      rateLimited = err.status === 429;
    }

    if (!rateLimited) {
      throw new Error('Contact support rate limiting failed to block 4th submission within 10 minutes');
    }
    console.log(`[PASS] Contact support ticket IP rate limiting (max 3/10min) verified.`);

    console.log('=== All Model & Functional Requirement Alignment Tests PASSED Successfully! ===');
  } catch (err) {
    console.error('Alignment test failed:', err);
    process.exit(1);
  }
}

runAlignmentTest();
