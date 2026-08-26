import dotenv from 'dotenv';
dotenv.config();

import { ChapaStrategy } from '../apps/financial-service/src/modules/payments/strategies/chapa.strategy';
import { StripeStrategy } from '../apps/financial-service/src/modules/payments/strategies/stripe.strategy';
import { PaymentWebhookController } from '../apps/financial-service/src/modules/payments/webhook.controller';
import { AppConfigService } from '../libs/config/src/index';

async function testWebhooks() {
  console.log('===============================================================');
  console.log('🧪 VERIFYING CHAPA & STRIPE PAYMENT WEBHOOKS');
  console.log('===============================================================');

  const nestConfig = new (require('@nestjs/config').ConfigService)();
  const config = new AppConfigService(nestConfig);
  const chapaStrategy = new ChapaStrategy(config);
  const stripeStrategy = new StripeStrategy(config);

  const completedRefs: string[] = [];
  const failedRefs: string[] = [];

  const mockPaymentService: any = {
    markPaymentCompletedByReference: async (ref: string, data: any) => {
      completedRefs.push(ref);
      return { id: `pay-${ref}`, status: 'COMPLETED', transactionReference: ref };
    },
    markPaymentFailedByReference: async (ref: string, reason: string, data: any) => {
      failedRefs.push(ref);
      return { id: `pay-${ref}`, status: 'FAILED', transactionReference: ref, reason };
    },
  };

  const controller = new PaymentWebhookController(
    mockPaymentService,
    chapaStrategy,
    stripeStrategy
  );

  console.log('\n--- 1. TESTING CHAPA WEBHOOK (SUCCESS PAYLOAD) ---');
  const chapaSuccessPayload = {
    tx_ref: 'TX-CHAPA-SUCCESS-001',
    status: 'success',
    amount: '1500',
    currency: 'ETB',
    email: 'client@tebeka.et',
  };
  const chapaRes = await controller.handleChapaWebhook(
    chapaSuccessPayload,
    'mock-signature',
    { rawBody: Buffer.from(JSON.stringify(chapaSuccessPayload)) }
  );
  console.log('Chapa Success Response:', chapaRes);
  if (chapaRes.status === 'success' && completedRefs.includes('TX-CHAPA-SUCCESS-001')) {
    console.log('✅ Chapa Success Webhook correctly processed and marked payment COMPLETED');
  } else {
    throw new Error('Chapa Success Webhook failed');
  }

  console.log('\n--- 2. TESTING CHAPA WEBHOOK (FAILED PAYLOAD) ---');
  const chapaFailedPayload = {
    tx_ref: 'TX-CHAPA-FAIL-002',
    status: 'failed',
    message: 'User cancelled transaction',
  };
  const chapaFailRes = await controller.handleChapaWebhook(
    chapaFailedPayload,
    'mock-signature',
    { rawBody: Buffer.from(JSON.stringify(chapaFailedPayload)) }
  );
  console.log('Chapa Failure Response:', chapaFailRes);
  if (chapaFailRes.status === 'failed' && failedRefs.includes('TX-CHAPA-FAIL-002')) {
    console.log('✅ Chapa Failure Webhook correctly processed and marked payment FAILED');
  } else {
    throw new Error('Chapa Failure Webhook failed');
  }

  console.log('\n--- 3. TESTING STRIPE WEBHOOK (CHECKOUT SESSION COMPLETED) ---');
  const stripeSessionPayload = {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_session_123',
        client_reference_id: 'TX-STRIPE-SESSION-003',
        payment_status: 'paid',
      },
    },
  };
  const stripeRes = await controller.handleStripeWebhook(
    stripeSessionPayload,
    'mock-stripe-sig',
    { rawBody: Buffer.from(JSON.stringify(stripeSessionPayload)) }
  );
  console.log('Stripe Checkout Session Response:', stripeRes);
  if (stripeRes.status === 'success' && completedRefs.includes('TX-STRIPE-SESSION-003')) {
    console.log('✅ Stripe Checkout Session Webhook correctly processed and marked payment COMPLETED');
  } else {
    throw new Error('Stripe Checkout Session Webhook failed');
  }

  console.log('\n--- 4. TESTING STRIPE WEBHOOK (PAYMENT INTENT SUCCEEDED) ---');
  const stripeIntentPayload = {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_intent_456',
        metadata: { txRef: 'TX-STRIPE-INTENT-004' },
        amount_received: 25000,
      },
    },
  };
  const stripeIntentRes = await controller.handleStripeWebhook(
    stripeIntentPayload,
    'mock-stripe-sig',
    { rawBody: Buffer.from(JSON.stringify(stripeIntentPayload)) }
  );
  console.log('Stripe PaymentIntent Response:', stripeIntentRes);
  if (stripeIntentRes.status === 'success' && completedRefs.includes('TX-STRIPE-INTENT-004')) {
    console.log('✅ Stripe PaymentIntent Webhook correctly processed and marked payment COMPLETED');
  } else {
    throw new Error('Stripe PaymentIntent Webhook failed');
  }

  console.log('\n--- 5. TESTING STRIPE WEBHOOK (PAYMENT INTENT FAILED) ---');
  const stripeFailIntentPayload = {
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: 'pi_test_intent_fail_789',
        metadata: { txRef: 'TX-STRIPE-FAIL-005' },
        last_payment_error: { message: 'Insufficient funds on credit card' },
      },
    },
  };
  const stripeFailIntentRes = await controller.handleStripeWebhook(
    stripeFailIntentPayload,
    'mock-stripe-sig',
    { rawBody: Buffer.from(JSON.stringify(stripeFailIntentPayload)) }
  );
  console.log('Stripe PaymentIntent Failure Response:', stripeFailIntentRes);
  if (stripeFailIntentRes.status === 'failed' && failedRefs.includes('TX-STRIPE-FAIL-005')) {
    console.log('✅ Stripe PaymentIntent Failure Webhook correctly processed and marked payment FAILED');
  } else {
    throw new Error('Stripe PaymentIntent Failure Webhook failed');
  }

  console.log('\n--- 6. TESTING STRIPE CONNECT ACCOUNT ONBOARDING UPDATE ---');
  const stripeAccountPayload = {
    type: 'account.updated',
    data: {
      object: {
        id: 'acct_attorney_test_999',
        charges_enabled: true,
        details_submitted: true,
      },
    },
  };
  const stripeAccountRes = await controller.handleStripeWebhook(
    stripeAccountPayload,
    'mock-stripe-sig',
    { rawBody: Buffer.from(JSON.stringify(stripeAccountPayload)) }
  );
  console.log('Stripe Account Update Response:', stripeAccountRes);
  if (stripeAccountRes.status === 'acknowledged' && stripeAccountRes.event === 'account.updated') {
    console.log('✅ Stripe Connect Account Webhook correctly acknowledged and parsed');
  } else {
    throw new Error('Stripe Connect Account Webhook failed');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL PAYMENT WEBHOOK SUITES PASSED FLAWLESSLY!');
  console.log('===============================================================');
}

testWebhooks().catch((err) => {
  console.error('❌ Webhook test failed:', err);
  process.exit(1);
});
