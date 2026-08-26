import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client/financial';
import { ChapaStrategy } from '../apps/financial-service/src/modules/payments/strategies/chapa.strategy';
import { StripeStrategy } from '../apps/financial-service/src/modules/payments/strategies/stripe.strategy';
import { GeoPaymentService } from '../apps/financial-service/src/modules/payments/services/geo-payment.service';
import { TransactionService } from '../apps/financial-service/src/modules/payments/services/transaction.service';
import { FinancialAnalyticsService } from '../apps/financial-service/src/modules/payments/services/financial-analytics.service';
import { PaymentService } from '../apps/financial-service/src/modules/payments/payment.service';
import { PayoutWalletService } from '../apps/financial-service/src/modules/payments/services/payout-wallet.service';
import { PaymentRefundService } from '../apps/financial-service/src/modules/payments/services/payment-refund.service';
import { AppConfigService } from '../libs/config/src/index';

const prisma = new PrismaClient();

async function runE2ETest() {
  console.log('===============================================================');
  console.log('🚀 STARTING END-TO-END PAYMENT & SPLIT SETTLEMENT TEST WITH LIVE KEYS');
  console.log('===============================================================');

  const nestConfig = new (require('@nestjs/config').ConfigService)();
  const config = new AppConfigService(nestConfig);
  const chapaStrategy = new ChapaStrategy(config);
  const stripeStrategy = new StripeStrategy(config);
  const geoPaymentService = new GeoPaymentService();
  const walletService = new PayoutWalletService(chapaStrategy, stripeStrategy);
  const refundService = new PaymentRefundService();
  const transactionService = new TransactionService();
  const analyticsService = new FinancialAnalyticsService();

  const paymentService = new PaymentService(
    chapaStrategy,
    stripeStrategy,
    refundService,
    walletService,
    geoPaymentService
  );

  console.log('\n--- 1. TESTING LIVE CHAPA INTEGRATION ---');
  console.log('Fetching Ethiopian bank list directly from Chapa API...');
  const banks = await chapaStrategy.getBanks();
  console.log(`✅ Successfully fetched ${banks.length} banks from Chapa!`);
  console.log(`Sample Banks: ${banks.slice(0, 3).map((b: any) => `${b.name} (Code: ${b.id || b.code})`).join(', ')}`);

  const clientETB = 'client-test-e2e-etb';
  const attorneyETB = 'attorney-test-e2e-etb';
  const txRefChapa = `TX-TEST-CHAPA-${Date.now()}`;

  console.log(`\nInitializing live Chapa payment for ${txRefChapa} (5,000 ETB)...`);
  const chapaCheckout = await paymentService.createPayment(
    {
      payerId: clientETB,
      payeeId: attorneyETB,
      amount: 5000,
      currency: 'ETB',
      provider: 'CHAPA',
      paymentType: 'CASE_MILESTONE',
      milestoneName: 'E2E Milestone Phase 1',
      description: 'Chapa Live Test Payment',
      email: 'abeldesalegn97@gmail.com',
      firstName: 'Abebe',
      lastName: 'Kebede',
      phone: '0911223344',
      txRef: txRefChapa,
      returnUrl: 'https://tebeka.et/payment/success',
    },
    clientETB,
    '196.188.1.1' // Ethiopian IP
  );

  console.log('✅ Chapa Checkout initialized:');
  console.log(`   - Status: ${chapaCheckout.status}`);
  console.log(`   - Checkout URL: ${chapaCheckout.checkoutUrl}`);
  console.log(`   - Transaction Reference: ${chapaCheckout.transactionReference}`);
  console.log(`   - Provider: ${chapaCheckout.provider}`);

  console.log('\n--- 2. TESTING LIVE STRIPE INTEGRATION ---');
  console.log('Creating live Stripe Connect Express account for attorney...');
  const stripeAccount = await stripeStrategy.createConnectAccount({
    attorneyId: 'attorney-stripe-e2e-1',
    email: 'attorney.stripe.test@tebeka.et',
    country: 'US',
    businessName: 'Tebeka Diaspora Legal LLC',
  });
  console.log(`✅ Stripe Connect Account created: ${stripeAccount.accountId}`);

  console.log('Generating Stripe onboarding link...');
  const onboardingLink = await stripeStrategy.createAccountLink(stripeAccount.accountId);
  console.log(`✅ Onboarding URL: ${onboardingLink}`);

  const txRefStripe = `TX-TEST-STRIPE-${Date.now()}`;
  console.log(`\nInitializing live Stripe Split Checkout for ${txRefStripe} ($250 USD, 15% Platform Commission)...`);
  const stripeCheckout = await paymentService.createPayment(
    {
      payerId: 'client-diaspora-1',
      payeeId: 'attorney-stripe-e2e-1',
      amount: 250,
      currency: 'USD',
      provider: 'STRIPE',
      paymentType: 'CONSULTATION_ONE_TIME',
      description: 'Stripe Live Split Consultation',
      email: 'diaspora.client@example.com',
      txRef: txRefStripe,
      splitPercentage: 15,
      returnUrl: 'https://tebeka.et/payment/success',
    },
    'client-diaspora-1',
    '8.8.8.8' // US IP
  );

  console.log('✅ Stripe Checkout session initialized:');
  console.log(`   - Status: ${stripeCheckout.status}`);
  console.log(`   - Checkout URL: ${stripeCheckout.checkoutUrl}`);
  console.log(`   - Transaction Reference: ${stripeCheckout.transactionReference}`);
  console.log(`   - Provider: ${stripeCheckout.provider}`);

  console.log('\n--- 3. SIMULATING WEBHOOK CONFIRMATION & SETTLEMENT ---');
  console.log(`Marking payment [${chapaCheckout.transactionReference}] as COMPLETED...`);
  await paymentService.markPaymentCompletedByReference(chapaCheckout.transactionReference);
  console.log(`Marking payment [${stripeCheckout.transactionReference}] as COMPLETED...`);
  await paymentService.markPaymentCompletedByReference(stripeCheckout.transactionReference);

  console.log('\n--- 4. TESTING CLIENT TRANSACTION FLOW ---');
  const clientTxs = await transactionService.getClientTransactions(clientETB, { page: 1, limit: 10 });
  console.log(`✅ Client [${clientETB}] Transactions count: ${clientTxs.summary.totalTransactions}`);
  console.log(`   - Total ETB Spent: ${clientTxs.summary.spent.ETB.totalSpent} ETB`);
  console.log(`   - Transaction List (${clientTxs.data.length} items):`);
  clientTxs.data.forEach((t: any) => console.log(`     * Ref: ${t.transactionReference} | Amount: ${t.amount} ${t.currency} | Status: ${t.status}`));

  console.log('\n--- 5. TESTING ATTORNEY TRANSACTION LEDGER & TAKE-HOME ---');
  const attorneyTxs = await transactionService.getAttorneyTransactions(attorneyETB, { page: 1, limit: 10 });
  console.log(`✅ Attorney [${attorneyETB}] Transactions count: ${attorneyTxs.summary.totalTransactions}`);
  console.log(`   - Gross Earned: ${attorneyTxs.summary.earnings.ETB.gross} ETB`);
  console.log(`   - Commission Deducted (15%): ${attorneyTxs.summary.earnings.ETB.commissionDeducted} ETB`);
  console.log(`   - Net Take-Home: ${attorneyTxs.summary.earnings.ETB.netEarned} ETB`);
  console.log(`   - Wallet Available Balance: ${attorneyTxs.wallet.availableBalance} ETB`);
  console.log(`   - Wallet Pending Balance: ${attorneyTxs.wallet.pendingBalance} ETB`);

  console.log('\n--- 6. TESTING ADMIN OVERALL TRANSACTIONS & ANALYTICS ---');
  const adminTxs = await transactionService.getAdminTransactions({ limit: 5 });
  console.log(`✅ Admin Total Platform Transactions: ${adminTxs.summary.totalTransactions}`);
  console.log(`   - ETB Gross Volume: ${adminTxs.summary.volume.ETB.gross} ETB`);
  console.log(`   - ETB Platform Commission: ${adminTxs.summary.volume.ETB.platformCommission} ETB`);
  console.log(`   - USD Gross Volume: $${adminTxs.summary.volume.USD.gross} USD`);
  console.log(`   - USD Platform Commission: $${adminTxs.summary.volume.USD.platformCommission} USD`);

  const adminAnalytics = await analyticsService.getAdminAnalytics({ period: '30d' });
  console.log(`✅ Admin Analytics Success Rate: ${adminAnalytics.kpis.transactions.successRatePercentage}%`);
  console.log(`   - Unique Paying Clients: ${adminAnalytics.kpis.activity.uniqueClientsCount}`);
  console.log(`   - Active Earning Attorneys: ${adminAnalytics.kpis.activity.activeAttorneysCount}`);

  console.log('\n--- 7. TESTING TRANSACTION RECEIPT GENERATION ---');
  const receipt = await transactionService.getTransactionReceipt(chapaCheckout.transactionReference);
  console.log(`✅ Printable Receipt Generated:`);
  console.log(`   - Receipt Number: ${receipt.receipt.receiptNumber}`);
  console.log(`   - Gross Amount: ${receipt.receipt.pricing.grossAmount} ${receipt.receipt.pricing.currency}`);
  console.log(`   - Platform Fee: ${receipt.receipt.pricing.commissionFee} ${receipt.receipt.pricing.currency}`);
  console.log(`   - Net Payee Amount: ${receipt.receipt.pricing.netPayeeAmount} ${receipt.receipt.pricing.currency}`);
  console.log(`   - Merchant: ${receipt.receipt.merchant.name}`);

  console.log('\n===============================================================');
  console.log('🎉 ALL LIVE PAYMENT, SPLIT-SETTLEMENT & ANALYTICS TESTS PASSED!');
  console.log('===============================================================');

  await prisma.$disconnect();
}

runE2ETest().catch((err) => {
  console.error('❌ E2E Payment Test failed:', err);
  process.exit(1);
});
