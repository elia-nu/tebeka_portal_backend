import { Controller, Get, Post, Body, Headers, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
import { Public } from '@workspace/auth';
import { PaymentService } from './payment.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

@Public()
@Controller('payments/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly chapaStrategy: ChapaStrategy,
    private readonly stripeStrategy: StripeStrategy,
  ) {}

  /**
   * Webhook Configuration & Health Status
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getWebhookHealth() {
    return {
      status: 'ok',
      service: 'financial-service',
      webhooks: {
        chapa: {
          endpoint: '/api/v1/payments/webhooks/chapa',
          methods: ['GET', 'POST'],
          configured: !!(process.env.CHAPA_SECRET || process.env.CHAPA_SECRET_KEY),
        },
        stripe: {
          endpoint: '/api/v1/payments/webhooks/stripe',
          methods: ['POST'],
          configured: !!(process.env.STRIPE_SECRET || process.env.STRIPE_SECRET_KEY),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Chapa Payment Webhook Handler (POST)
   * Handles payment status callbacks (success, failed, pending) from Chapa webhook server events.
   */
  @Post('chapa')
  @HttpCode(HttpStatus.OK)
  async handleChapaWebhookPost(
    @Body() body: any,
    @Headers('x-chapa-signature') rawSig: string,
    @Req() req: any
  ) {
    return this.processChapaWebhookOrCallback(body, rawSig, req);
  }

  /**
   * Chapa Payment Callback / Redirect Handler (GET)
   * Handles browser redirects, query callbacks, and JSONP from Chapa.
   */
  @Get('chapa')
  @HttpCode(HttpStatus.OK)
  async handleChapaWebhookGet(
    @Headers('x-chapa-signature') rawSig: string,
    @Req() req: any
  ) {
    return this.processChapaWebhookOrCallback(null, rawSig, req);
  }

  private async processChapaWebhookOrCallback(
    body: any,
    rawSig: string,
    req: any
  ) {
    const query = req?.query || {};
    const mergedData = { ...query, ...(body || {}) };
    this.logger.log(`📥 Received Chapa Webhook/Callback [${req?.method}]: ${JSON.stringify(mergedData)}`);

    const signature = rawSig || req?.headers?.['x-chapa-signature'] || req?.headers?.['chapa-signature'] || req?.headers?.['x-signature'];
    const rawBody = req?.rawBody;

    // Extract transaction reference from multiple possible Chapa payload & query formats
    const txRef =
      mergedData?.tx_ref ||
      mergedData?.trx_ref ||
      mergedData?.reference ||
      mergedData?.ref_id ||
      mergedData?.data?.tx_ref ||
      mergedData?.data?.trx_ref ||
      mergedData?.data?.reference;

    let rawStatus = (mergedData?.status || mergedData?.data?.status || mergedData?.event || '').toString().toLowerCase();

    // Verify webhook signature if present or in production for POST
    if (signature) {
      const isValid = this.chapaStrategy.verifyWebhookSignature(signature, body || mergedData, rawBody);
      if (!isValid && process.env.NODE_ENV === 'production') {
        this.logger.warn(`Invalid Chapa webhook signature: [${signature}]`);
        return { status: 'ignored', reason: 'Invalid signature' };
      }
    } else if (req?.method === 'GET' && txRef && rawStatus === 'success') {
      // For GET browser redirect/callbacks without webhook header, verify directly against Chapa's verify API
      try {
        const verifyRes = await this.chapaStrategy.verifyPayment(txRef);
        if (verifyRes.status !== 'COMPLETED') {
          this.logger.warn(`Chapa verifyPayment check returned ${verifyRes.status} for [${txRef}]`);
          rawStatus = verifyRes.status.toLowerCase();
        }
      } catch (err: any) {
        this.logger.warn(`Chapa direct verification note for [${txRef}]: ${err.message}`);
      }
    }

    if (!txRef) {
      this.logger.warn(`Chapa webhook received without a valid transaction reference: ${JSON.stringify(mergedData)}`);
      return { status: 'acknowledged', message: 'No transaction reference found' };
    }

    // 1. Success event
    if (rawStatus === 'success' || rawStatus === 'charge.success' || rawStatus === 'completed') {
      this.logger.log(`Processing Chapa successful payment for reference: ${txRef}`);
      const updated = await this.paymentService.markPaymentCompletedByReference(txRef, mergedData);
      if (!updated) {
        this.logger.warn(`Chapa payment reference not found in database: ${txRef}`);
        return { status: 'acknowledged', message: `Reference ${txRef} not found` };
      }
      return {
        status: 'success',
        message: 'Payment marked as COMPLETED',
        paymentId: updated.id,
        reference: txRef,
      };
    }

    // 2. Failure event
    if (rawStatus === 'failed' || rawStatus === 'charge.failed' || rawStatus === 'cancelled') {
      this.logger.warn(`Processing Chapa payment failure for reference: ${txRef}`);
      const failureReason = mergedData?.message || mergedData?.data?.message || 'Chapa payment failed';
      const updated = await this.paymentService.markPaymentFailedByReference(txRef, failureReason, mergedData);
      return {
        status: 'failed',
        message: 'Payment marked as FAILED',
        paymentId: updated?.id,
        reference: txRef,
      };
    }

    this.logger.log(`Chapa webhook acknowledged with status: ${rawStatus} for ${txRef}`);
    return { status: 'acknowledged', message: `Status '${rawStatus}' acknowledged` };
  }

  /**
   * Stripe Webhook Handler
   * Handles checkout session, payment intent, charge, and connected account events.
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
    @Req() req: any
  ) {
    const rawBody = req?.rawBody;
    const event = this.stripeStrategy.constructEvent(signature, body, rawBody);

    if (!event && process.env.NODE_ENV === 'production') {
      this.logger.warn('Invalid Stripe webhook signature');
      return { status: 'ignored', reason: 'Invalid signature' };
    }

    // Use verified Stripe event or fallback to parsed body
    const eventData = event || body;
    const eventType = eventData?.type;
    const eventObject = eventData?.data?.object;

    this.logger.log(`📥 Received Stripe Webhook event: [${eventType}]`);

    // 1. Checkout Session Completed or Async Payment Succeeded
    if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
      const session = eventObject;
      const txRef = session?.client_reference_id || session?.metadata?.txRef || session?.metadata?.transactionReference || session?.id;
      const isPaid = session?.payment_status === 'paid' || session?.payment_status === 'no_payment_required' || eventType === 'checkout.session.async_payment_succeeded';

      if (txRef && isPaid) {
        this.logger.log(`Processing Stripe Checkout completion for [${txRef}]`);
        const updated = await this.paymentService.markPaymentCompletedByReference(txRef, session);
        return {
          status: 'success',
          message: 'Payment marked as COMPLETED via Checkout Session',
          paymentId: updated?.id,
          reference: txRef,
        };
      } else if (txRef && session?.payment_status === 'unpaid') {
        this.logger.log(`Stripe Checkout Session [${txRef}] is still unpaid.`);
        return { status: 'pending', message: 'Checkout session payment pending' };
      }
    }

    // 2. Checkout Session Expired or Async Payment Failed
    if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') {
      const session = eventObject;
      const txRef = session?.client_reference_id || session?.metadata?.txRef || session?.id;
      if (txRef) {
        this.logger.warn(`Stripe Checkout Session [${txRef}] failed or expired.`);
        const updated = await this.paymentService.markPaymentFailedByReference(txRef, 'Stripe Checkout Session expired or async payment failed', session);
        return {
          status: 'failed',
          message: 'Payment marked as FAILED',
          paymentId: updated?.id,
          reference: txRef,
        };
      }
    }

    // 3. PaymentIntent Succeeded
    if (eventType === 'payment_intent.succeeded') {
      const intent = eventObject;
      const txRef = intent?.metadata?.txRef || intent?.metadata?.transactionReference || intent?.metadata?.paymentId || intent?.id;
      if (txRef) {
        this.logger.log(`Processing Stripe PaymentIntent success for [${txRef}]`);
        const updated = await this.paymentService.markPaymentCompletedByReference(txRef, intent);
        return {
          status: 'success',
          message: 'Payment marked as COMPLETED via PaymentIntent',
          paymentId: updated?.id,
          reference: txRef,
        };
      }
    }

    // 4. PaymentIntent Failed or Canceled
    if (eventType === 'payment_intent.payment_failed' || eventType === 'payment_intent.canceled') {
      const intent = eventObject;
      const txRef = intent?.metadata?.txRef || intent?.metadata?.transactionReference || intent?.id;
      const failureReason = intent?.last_payment_error?.message || intent?.cancellation_reason || 'Payment intent failed';
      if (txRef) {
        this.logger.warn(`Stripe PaymentIntent [${txRef}] failed: ${failureReason}`);
        const updated = await this.paymentService.markPaymentFailedByReference(txRef, failureReason, intent);
        return {
          status: 'failed',
          message: 'Payment marked as FAILED via PaymentIntent',
          paymentId: updated?.id,
          reference: txRef,
        };
      }
    }

    // 5. Charge Succeeded
    if (eventType === 'charge.succeeded') {
      const charge = eventObject;
      const txRef = charge?.metadata?.txRef || charge?.metadata?.transactionReference;
      if (txRef) {
        this.logger.log(`Processing Stripe Charge success for [${txRef}]`);
        const updated = await this.paymentService.markPaymentCompletedByReference(txRef, charge);
        return {
          status: 'success',
          message: 'Payment marked as COMPLETED via Charge',
          paymentId: updated?.id,
          reference: txRef,
        };
      }
    }

    // 6. Charge Failed
    if (eventType === 'charge.failed') {
      const charge = eventObject;
      const txRef = charge?.metadata?.txRef || charge?.metadata?.transactionReference;
      if (txRef) {
        this.logger.warn(`Stripe Charge [${txRef}] failed: ${charge?.failure_message}`);
        const updated = await this.paymentService.markPaymentFailedByReference(txRef, charge?.failure_message || 'Charge failed', charge);
        return {
          status: 'failed',
          message: 'Payment marked as FAILED via Charge',
          paymentId: updated?.id,
          reference: txRef,
        };
      }
    }

    // 7. Attorney Stripe Connect Account Onboarding Status Updates
    if (eventType === 'account.updated') {
      const account = eventObject;
      this.logger.log(`Stripe Connect account updated: ${account?.id} (charges_enabled=${account?.charges_enabled}, details_submitted=${account?.details_submitted})`);
      return { status: 'acknowledged', event: 'account.updated', accountId: account?.id };
    }

    return { status: 'acknowledged', eventType: eventType || 'unknown' };
  }
}
