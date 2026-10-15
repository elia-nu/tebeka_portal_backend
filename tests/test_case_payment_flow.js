require('dotenv').config();
const { PrismaClient: MarketplacePrisma } = require('@prisma/client/marketplace');
const { PrismaClient: FinancialPrisma } = require('@prisma/client/financial');

const marketplacePrisma = new MarketplacePrisma();
const financialPrisma = new FinancialPrisma();

async function runCasePaymentFlowTest() {
  console.log('========================================================================');
  console.log('🧪  STARTING END-TO-END CASE PAYMENT FLOW TEST SUITE                   ');
  console.log('========================================================================\n');

  const testSuffix = Date.now();
  const clientId = `client_case_${testSuffix}`;
  const attorneyId = `attorney_case_${testSuffix}`;
  const caseRef = `CASE-PAY-TEST-${testSuffix}`;

  const createdCaseIds = [];
  const createdPaymentIds = [];

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Setup Attorney Wallet & Platform Commission Baseline
    // -------------------------------------------------------------------------
    console.log('📌 [Step 1] Setting up Attorney Payout Wallet & Commission Rates...');
    const splitPercentage = 15.0; // 15% Platform Commission, 85% Attorney
    const initialWallet = await financialPrisma.wallet.create({
      data: {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'ETB',
        splitPercentage: splitPercentage,
        chapaSubaccountId: `SUBACCT_${testSuffix}`,
        bankName: 'Commercial Bank of Ethiopia',
        accountNumber: '1000123456789',
      },
    });
    console.log(`   ✅ Attorney Wallet created with 0.00 ETB pending balance, ${splitPercentage}% commission rate.`);

    // -------------------------------------------------------------------------
    // STEP 2: Create Legal Case with Tri-Party Agreement & Milestones
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 2] Creating Legal Case with Agreement Room and Milestones...');
    const legalCase = await marketplacePrisma.case.create({
      data: {
        referenceNumber: caseRef,
        clientId,
        attorneyId,
        title: 'Commercial Breach of Contract & Asset Recovery',
        description: 'Litigation concerning cross-border procurement agreement non-performance.',
        status: 'OPEN',
        agreement: {
          create: {
            agreementType: 'CASE_ENGAGEMENT_NON_CIRCUMVENTION',
            version: 1,
            termsContent: '# Tebeka Legal Services & Escrow Agreement',
            status: 'PENDING_SIGNATURES',
          },
        },
        caseMilestones: {
          create: [
            {
              title: 'Phase 1: Legal Notice & Statement of Claim Draft',
              status: 'PENDING',
              dueDate: new Date(Date.now() + 7 * 86400000),
            },
            {
              title: 'Phase 2: High Court Representation & Pleadings',
              status: 'PENDING',
              dueDate: new Date(Date.now() + 30 * 86400000),
            },
          ],
        },
        caseTimelines: {
          create: [
            {
              title: 'Case Initialized',
              description: `Case opened with reference ${caseRef}`,
              eventDate: new Date(),
            },
          ],
        },
      },
      include: {
        agreement: true,
        caseMilestones: true,
        caseTimelines: true,
      },
    });

    createdCaseIds.push(legalCase.id);
    console.log(`   ✅ Case Created: ID=${legalCase.id}, Reference=${legalCase.referenceNumber}`);
    console.log(`   ✅ Agreement Room Created: ID=${legalCase.agreement.id}, Status=${legalCase.agreement.status}`);
    console.log(`   ✅ Milestones Created: count=${legalCase.caseMilestones.length}`);
    legalCase.caseMilestones.forEach((m, idx) => {
      console.log(`      ${idx + 1}. [${m.status}] "${m.title}" (ID: ${m.id})`);
    });

    // -------------------------------------------------------------------------
    // STEP 3: Mutual Execution of Tri-Party Agreement (Gate Check)
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 3] Mutual Execution of Tri-Party Agreement...');
    const executedAgreement = await marketplacePrisma.$transaction(async (tx) => {
      // Client signs
      await tx.caseAgreement.update({
        where: { id: legalCase.agreement.id },
        data: {
          clientSigned: true,
          clientSignedAt: new Date(),
          clientSignerName: 'Test Client',
          clientSignerIp: '197.156.100.1',
          nonCircumventionAck: true,
          platformFeeAck: true,
          confidentialityAck: true,
        },
      });

      // Attorney signs
      const fullySigned = await tx.caseAgreement.update({
        where: { id: legalCase.agreement.id },
        data: {
          attorneySigned: true,
          attorneySignedAt: new Date(),
          attorneySignerName: 'Test Advocate',
          attorneySignerIp: '197.156.100.2',
          status: 'FULLY_EXECUTED',
          fullyExecutedAt: new Date(),
        },
      });

      await tx.caseTimeline.create({
        data: {
          caseId: legalCase.id,
          title: 'Tri-Party Engagement Agreement Executed',
          description: 'Client and Attorney mutually executed agreement. Workspace unlocked.',
          eventDate: new Date(),
        },
      });

      return fullySigned;
    });

    if (executedAgreement.status !== 'FULLY_EXECUTED') {
      throw new Error(`Agreement execution failed, got ${executedAgreement.status}`);
    }
    console.log(`   ✅ Agreement status verified: FULLY_EXECUTED at ${executedAgreement.fullyExecutedAt}`);

    // -------------------------------------------------------------------------
    // STEP 4: Attorney Requests Milestone Payment (Escrow Request)
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 4] Attorney Requests Milestone Escrow Fee (15,000 ETB)...');
    const milestone1 = legalCase.caseMilestones[0];
    const requestedAmount = 15000.0;
    const expectedCommission = (requestedAmount * splitPercentage) / 100; // 2,250 ETB
    const expectedNetPayout = requestedAmount - expectedCommission; // 12,750 ETB
    const txReqRef = `TX-REQ-${Date.now()}-M1`;

    const paymentReq = await financialPrisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          caseId: legalCase.id,
          payerId: clientId,
          payeeId: attorneyId,
          paymentType: 'CASE_MILESTONE',
          amount: requestedAmount,
          currency: 'ETB',
          commission: expectedCommission,
          subaccountId: initialWallet.chapaSubaccountId,
          splitPercentage: splitPercentage,
          transactionReference: txReqRef,
          status: 'PENDING',
          requestedBy: attorneyId,
          requestedAt: new Date(),
          description: 'Escrow deposit for Phase 1 pleadings draft and court filing.',
          milestoneName: milestone1.title,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: p.id,
          eventType: 'PAYMENT_REQUESTED',
          payload: {
            paymentId: p.id,
            caseId: legalCase.id,
            requestedBy: attorneyId,
            clientId,
            amount: p.amount,
            commission: p.commission,
            subaccountId: initialWallet.chapaSubaccountId,
            splitPercentage: splitPercentage,
            transactionReference: txReqRef,
          },
        },
      });

      return p;
    });

    createdPaymentIds.push(paymentReq.id);
    console.log(`   ✅ Payment Request Created: ID=${paymentReq.id}`);
    console.log(`      - Transaction Ref: ${paymentReq.transactionReference}`);
    console.log(`      - Payment Type:    ${paymentReq.paymentType}`);
    console.log(`      - Amount:          ${paymentReq.amount} ETB`);
    console.log(`      - Commission:      ${paymentReq.commission} ETB (15%)`);
    console.log(`      - Net Payout:      ${expectedNetPayout} ETB (85%)`);
    console.log(`      - Status:          ${paymentReq.status}`);

    if (paymentReq.status !== 'PENDING' || paymentReq.paymentType !== 'CASE_MILESTONE') {
      throw new Error(`Payment request assertion failed: status=${paymentReq.status}, type=${paymentReq.paymentType}`);
    }

    // -------------------------------------------------------------------------
    // STEP 5: Client Approves Payment & Escrow Completion (Body Inherited from Request)
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 5] Client Approves Payment: Inheriting Body from Payment Request (no re-entry needed)...');
    
    // Test that the client only needs to submit { paymentId }, inheriting caseId, amount, payeeId, milestoneName
    const clientApprovalInput = { paymentId: paymentReq.id };
    const fetchedRequest = await financialPrisma.payment.findUnique({ where: { id: clientApprovalInput.paymentId } });
    if (!fetchedRequest) throw new Error('Payment request not found');

    console.log(`   ✅ Successfully loaded requested payment from DB using only paymentId: "${clientApprovalInput.paymentId}"`);
    console.log(`      - Inherited Case ID:     ${fetchedRequest.caseId}`);
    console.log(`      - Inherited Milestone:   ${fetchedRequest.milestoneName}`);
    console.log(`      - Inherited Payee ID:    ${fetchedRequest.payeeId}`);
    console.log(`      - Inherited Amount:      ${fetchedRequest.amount} ${fetchedRequest.currency}`);
    console.log(`      - Inherited Commission:  ${fetchedRequest.commission} ${fetchedRequest.currency}`);

    if (
      fetchedRequest.caseId !== legalCase.id ||
      Number(fetchedRequest.amount) !== requestedAmount ||
      fetchedRequest.milestoneName !== milestone1.title
    ) {
      throw new Error('Inherited body mismatch from payment request');
    }

    const completedPayment = await financialPrisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { id: paymentReq.id } });
      if (!p) throw new Error('Payment not found');

      const updated = await tx.payment.update({
        where: { id: paymentReq.id },
        data: {
          status: 'COMPLETED',
          approvedBy: clientId,
          approvedAt: new Date(),
          paidAt: new Date(),
        },
      });

      const netAmount = Number(updated.amount) - Number(updated.commission);

      // Ledger Entry: Full Credit
      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: 'CREDIT',
          amount: updated.amount,
          balanceAfter: netAmount,
        },
      });

      // Ledger Entry: Platform Commission
      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: 'COMMISSION',
          amount: updated.commission,
          balanceAfter: updated.commission,
        },
      });

      // Credit Attorney Wallet Pending Balance
      await tx.wallet.update({
        where: { userId: attorneyId },
        data: {
          pendingBalance: { increment: netAmount },
        },
      });

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: updated.id,
          eventType: 'PAYMENT_COMPLETED',
          payload: {
            paymentId: updated.id,
            caseId: updated.caseId,
            bookingId: null,
            milestoneName: updated.milestoneName,
            paymentType: updated.paymentType,
            payerId: updated.payerId,
            payeeId: updated.payeeId,
            amount: Number(updated.amount),
            currency: updated.currency,
            status: 'COMPLETED',
            approvedBy: clientId,
          },
        },
      });

      return updated;
    });

    console.log(`   ✅ Payment Status: ${completedPayment.status} (approvedBy: ${completedPayment.approvedBy})`);

    // Verify Ledger Entries
    const ledgers = await financialPrisma.ledgerEntry.findMany({
      where: { paymentId: completedPayment.id },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`   ✅ Verified ${ledgers.length} Financial Ledger Entries:`);
    ledgers.forEach((l) => console.log(`      - [${l.entryType}] Amount: ${l.amount} ETB | BalanceAfter: ${l.balanceAfter} ETB`));

    if (ledgers.length < 2) {
      throw new Error(`Expected at least 2 ledger entries (CREDIT and COMMISSION), got ${ledgers.length}`);
    }

    // Verify Attorney Wallet Pending Balance
    const updatedWallet = await financialPrisma.wallet.findUnique({ where: { userId: attorneyId } });
    console.log(`   ✅ Attorney Pending Balance: ${updatedWallet.pendingBalance} ETB (Expected: ${expectedNetPayout} ETB)`);
    if (Number(updatedWallet.pendingBalance) !== expectedNetPayout) {
      throw new Error(`Wallet balance mismatch: got ${updatedWallet.pendingBalance}, expected ${expectedNetPayout}`);
    }

    // -------------------------------------------------------------------------
    // STEP 6: Cross-Service Event Ingestion & Case State Machine Activation
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 6] Cross-Service Event Ingestion: Activating Case & Milestone...');
    // Simulate marketplace-events consumer handling PAYMENT_COMPLETED
    const eventPayload = {
      paymentId: completedPayment.id,
      caseId: legalCase.id,
      milestoneName: completedPayment.milestoneName,
      amount: Number(completedPayment.amount),
      currency: completedPayment.currency,
      payerId: clientId,
      payeeId: attorneyId,
    };

    await marketplacePrisma.$transaction(async (tx) => {
      // 1. Activate Case Status from OPEN to IN_PROGRESS
      await tx.case.update({
        where: { id: eventPayload.caseId },
        data: { status: 'IN_PROGRESS' },
      });

      // 2. Activate Milestone Status from PENDING to IN_PROGRESS
      await tx.caseMilestone.update({
        where: { id: milestone1.id },
        data: { status: 'IN_PROGRESS' },
      });

      // 3. Add Case Timeline Event
      await tx.caseTimeline.create({
        data: {
          caseId: eventPayload.caseId,
          title: 'Milestone Escrow Payment Secured',
          description: `Payment of ${eventPayload.amount} ${eventPayload.currency} completed and held in escrow. Milestone "${eventPayload.milestoneName}" activated.`,
          eventDate: new Date(),
        },
      });

      // 4. Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: eventPayload.caseId,
          eventType: 'CASE_MILESTONE_PAID',
          payload: eventPayload,
        },
      });
    });

    const refreshedCase = await marketplacePrisma.case.findUnique({
      where: { id: legalCase.id },
      include: { caseMilestones: true, caseTimelines: true },
    });

    console.log(`   ✅ Refreshed Case Status: ${refreshedCase.status} (Expected: IN_PROGRESS)`);
    const refreshedMilestone1 = refreshedCase.caseMilestones.find((m) => m.id === milestone1.id);
    console.log(`   ✅ Milestone 1 Status:   ${refreshedMilestone1.status} (Expected: IN_PROGRESS)`);

    const milestonePaidTimeline = refreshedCase.caseTimelines.find((t) => t.title === 'Milestone Escrow Payment Secured');
    console.log(`   ✅ Timeline Event Logged: "${milestonePaidTimeline?.title}" - ${milestonePaidTimeline?.description}`);

    if (refreshedCase.status !== 'IN_PROGRESS' || refreshedMilestone1.status !== 'IN_PROGRESS' || !milestonePaidTimeline) {
      throw new Error('Case state machine activation assertion failed');
    }

    // -------------------------------------------------------------------------
    // STEP 7: Direct Gateway Webhook Checkout Flow (Chapa ETB)
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 7] Domestic Direct Checkout via Chapa (5,000 ETB for Phase 2)...');
    const milestone2 = legalCase.caseMilestones[1];
    const chapaAmount = 5000.0;
    const chapaCommission = (chapaAmount * splitPercentage) / 100; // 750 ETB
    const chapaNet = chapaAmount - chapaCommission; // 4,250 ETB
    const txChapaRef = `TX-CHAPA-${testSuffix}-M2`;

    const directChapaPayment = await financialPrisma.$transaction(async (tx) => {
      return tx.payment.create({
        data: {
          caseId: legalCase.id,
          payerId: clientId,
          payeeId: attorneyId,
          paymentType: 'CASE_MILESTONE',
          amount: chapaAmount,
          currency: 'ETB',
          commission: chapaCommission,
          subaccountId: initialWallet.chapaSubaccountId,
          splitPercentage: splitPercentage,
          transactionReference: txChapaRef,
          provider: 'CHAPA',
          status: 'PENDING',
          milestoneName: milestone2.title,
          description: 'Direct checkout for Phase 2 milestone representation.',
        },
      });
    });

    createdPaymentIds.push(directChapaPayment.id);
    console.log(`   ✅ Direct Payment created: Ref=${directChapaPayment.transactionReference}, Status=${directChapaPayment.status}`);

    // Simulate Chapa Webhook Confirmation
    console.log('   🔄 Simulating Chapa Webhook callback (status=success)...');
    const webhookCompleted = await financialPrisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { transactionReference: txChapaRef } });
      if (!p) throw new Error('Transaction reference not found');

      const updated = await tx.payment.update({
        where: { id: p.id },
        data: {
          status: 'COMPLETED',
          approvedBy: 'GATEWAY_WEBHOOK',
          approvedAt: new Date(),
          paidAt: new Date(),
        },
      });

      const net = Number(updated.amount) - Number(updated.commission);
      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: 'CREDIT',
          amount: updated.amount,
          balanceAfter: net,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: 'COMMISSION',
          amount: updated.commission,
          balanceAfter: updated.commission,
        },
      });

      await tx.wallet.update({
        where: { userId: attorneyId },
        data: {
          pendingBalance: { increment: net },
        },
      });

      return updated;
    });

    console.log(`   ✅ Webhook processed successfully: Status=${webhookCompleted.status}`);
    const walletAfterChapa = await financialPrisma.wallet.findUnique({ where: { userId: attorneyId } });
    const expectedTotalPending = expectedNetPayout + chapaNet; // 12,750 + 4,250 = 17,000 ETB
    console.log(`   ✅ Attorney Total Pending Balance: ${walletAfterChapa.pendingBalance} ETB (Expected: ${expectedTotalPending} ETB)`);
    if (Number(walletAfterChapa.pendingBalance) !== expectedTotalPending) {
      throw new Error(`Expected pending balance ${expectedTotalPending}, got ${walletAfterChapa.pendingBalance}`);
    }

    // -------------------------------------------------------------------------
    // STEP 7B: International Diaspora Stripe Split Payment ($500 USD Milestone)
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 7B] International Diaspora Payment via Stripe ($500 USD Case Fee)...');
    const stripeAmountUSD = 500.0;
    const stripeCommissionUSD = (stripeAmountUSD * splitPercentage) / 100; // $75 USD
    const stripeNetUSD = stripeAmountUSD - stripeCommissionUSD; // $425 USD
    const txStripeRef = `TX-STRIPE-${testSuffix}-USD`;
    const stripePaymentIntentId = `pi_test_${testSuffix}`;

    const stripeCasePayment = await financialPrisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          caseId: legalCase.id,
          payerId: clientId,
          payeeId: attorneyId,
          paymentType: 'CASE_MILESTONE',
          amount: stripeAmountUSD,
          currency: 'USD',
          commission: stripeCommissionUSD,
          subaccountId: `acct_stripe_${testSuffix}`,
          splitPercentage: splitPercentage,
          transactionReference: txStripeRef,
          stripePaymentId: stripePaymentIntentId,
          provider: 'STRIPE',
          status: 'PENDING',
          milestoneName: 'International Deposition & Arbitral Award',
          description: 'Diaspora cross-border legal fee milestone payment.',
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: p.id,
          eventType: 'PAYMENT_CREATED',
          payload: {
            paymentId: p.id,
            caseId: legalCase.id,
            payerId: clientId,
            payeeId: attorneyId,
            amount: p.amount,
            currency: 'USD',
            provider: 'STRIPE',
            transactionReference: txStripeRef,
            stripePaymentId: stripePaymentIntentId,
          },
        },
      });

      return p;
    });

    createdPaymentIds.push(stripeCasePayment.id);
    console.log(`   ✅ Stripe USD Payment created: Ref=${stripeCasePayment.transactionReference}, Amount=$${stripeCasePayment.amount} USD`);

    // Simulate Stripe Webhook: payment_intent.succeeded
    console.log('   🔄 Simulating Stripe Webhook (payment_intent.succeeded)...');
    const stripeCompleted = await financialPrisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: stripeCasePayment.id },
        data: {
          status: 'COMPLETED',
          approvedBy: 'STRIPE_WEBHOOK',
          approvedAt: new Date(),
          paidAt: new Date(),
        },
      });

      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: 'CREDIT',
          amount: updated.amount,
          balanceAfter: stripeNetUSD,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: 'COMMISSION',
          amount: updated.commission,
          balanceAfter: stripeCommissionUSD,
        },
      });

      return updated;
    });

    console.log(`   ✅ Stripe USD Case Payment Completed: Status=${stripeCompleted.status}`);
    console.log(`      - Net Payout: $${stripeNetUSD} USD (85%)`);
    console.log(`      - Platform Fee: $${stripeCommissionUSD} USD (15%)`);

    // -------------------------------------------------------------------------
    // STEP 8: Payment Failure & Gateway Webhook Rejection Handling
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 8] Testing Gateway Payment Failure Handling...');
    const txFailRef = `TX-FAIL-${testSuffix}`;
    const failedPayment = await financialPrisma.payment.create({
      data: {
        caseId: legalCase.id,
        payerId: clientId,
        payeeId: attorneyId,
        paymentType: 'CASE_MILESTONE',
        amount: 3000,
        currency: 'ETB',
        commission: 450,
        transactionReference: txFailRef,
        provider: 'CHAPA',
        status: 'PENDING',
        milestoneName: 'Extra Filing Cost',
      },
    });
    createdPaymentIds.push(failedPayment.id);

    // Simulate Chapa webhook reporting payment failure
    const markedFailed = await financialPrisma.payment.update({
      where: { id: failedPayment.id },
      data: {
        status: 'FAILED',
      },
    });

    console.log(`   ✅ Payment marked FAILED: ID=${markedFailed.id}, Status=${markedFailed.status}`);
    const walletAfterFail = await financialPrisma.wallet.findUnique({ where: { userId: attorneyId } });
    if (Number(walletAfterFail.pendingBalance) !== expectedTotalPending) {
      throw new Error(`Wallet balance was erroneously modified on failure! Balance: ${walletAfterFail.pendingBalance}`);
    }
    console.log(`   🛡️ Attorney Wallet balance remained intact at ${walletAfterFail.pendingBalance} ETB.`);

    // -------------------------------------------------------------------------
    // STEP 9: Transaction Ledger Aggregations & Role-Based Queries
    // -------------------------------------------------------------------------
    console.log('\n📌 [Step 9] Validating Role-Based Transaction Queries & Metrics...');
    // Client Query
    const clientPayments = await financialPrisma.payment.findMany({
      where: { payerId: clientId },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`   ✅ Client Payments Found: ${clientPayments.length}`);
    const completedCount = clientPayments.filter((p) => p.status === 'COMPLETED').length;
    const failedCount = clientPayments.filter((p) => p.status === 'FAILED').length;
    console.log(`      - Completed: ${completedCount}`);
    console.log(`      - Failed:    ${failedCount}`);

    // Attorney Query
    const attorneyPayments = await financialPrisma.payment.findMany({
      where: { payeeId: attorneyId },
    });

    const etbCompleted = attorneyPayments.filter((p) => p.status === 'COMPLETED' && p.currency === 'ETB');
    const etbGross = etbCompleted.reduce((sum, p) => sum + Number(p.amount), 0);
    const etbCommission = etbCompleted.reduce((sum, p) => sum + Number(p.commission), 0);
    const etbNet = etbGross - etbCommission;

    const usdCompleted = attorneyPayments.filter((p) => p.status === 'COMPLETED' && p.currency === 'USD');
    const usdGross = usdCompleted.reduce((sum, p) => sum + Number(p.amount), 0);
    const usdCommission = usdCompleted.reduce((sum, p) => sum + Number(p.commission), 0);
    const usdNet = usdGross - usdCommission;

    console.log(`   ✅ Attorney Case Transactions (ETB): Gross=${etbGross} ETB, Commission=${etbCommission} ETB, Net=${etbNet} ETB`);
    console.log(`   ✅ Attorney Case Transactions (USD): Gross=$${usdGross} USD, Commission=$${usdCommission} USD, Net=$${usdNet} USD`);

    if (etbGross !== 20000 || etbCommission !== 3000 || etbNet !== 17000) {
      throw new Error(`ETB metrics mismatch: gross=${etbGross}, comm=${etbCommission}, net=${etbNet}`);
    }
    if (usdGross !== 500 || usdCommission !== 75 || usdNet !== 425) {
      throw new Error(`USD metrics mismatch: gross=${usdGross}, comm=${usdCommission}, net=${usdNet}`);
    }

    console.log('\n========================================================================');
    console.log('🎉  ALL CASE PAYMENT FLOW TESTS PASSED SUCCESSFULLY!                    ');
    console.log('========================================================================\n');
  } catch (error) {
    console.error('\n❌ [TEST FAILURE]:', error);
    process.exitCode = 1;
  } finally {
    console.log('🧹 [Cleanup] Removing test artifacts from database...');
    try {
      if (createdPaymentIds.length > 0) {
        await financialPrisma.ledgerEntry.deleteMany({ where: { paymentId: { in: createdPaymentIds } } });
        await financialPrisma.outboxEvent.deleteMany({ where: { aggregateId: { in: createdPaymentIds } } });
        await financialPrisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
      }
      await financialPrisma.wallet.deleteMany({ where: { userId: attorneyId } });

      if (createdCaseIds.length > 0) {
        await marketplacePrisma.caseTimeline.deleteMany({ where: { caseId: { in: createdCaseIds } } });
        await marketplacePrisma.caseMilestone.deleteMany({ where: { caseId: { in: createdCaseIds } } });
        await marketplacePrisma.caseAgreement.deleteMany({ where: { caseId: { in: createdCaseIds } } });
        await marketplacePrisma.outboxEvent.deleteMany({ where: { aggregateId: { in: createdCaseIds } } });
        await marketplacePrisma.case.deleteMany({ where: { id: { in: createdCaseIds } } });
      }
      console.log('✅ Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    } finally {
      await marketplacePrisma.$disconnect();
      await financialPrisma.$disconnect();
    }
  }
}

runCasePaymentFlowTest();
