import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger, Req } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

@Controller('payments/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly chapaStrategy: ChapaStrategy,
    private readonly stripeStrategy: StripeStrategy,
  ) {}

  /**
   * Chapa Payment Webhook Handler
   * Handles payment status callbacks (success, failed, pending) from Chapa.
   */
  @Post('chapa')
  @HttpCode(HttpStatus.OK)
  async handleChapaWebhook(
    @Body() body: any,
    @Headers('x-chapa-signature') signature: string,
    @Req() req: any
  ) {
    this.logger.log(`📥 Received Chapa Webhook: ${JSON.stringify(body)}`);

    const rawBody = req?.rawBody;
    const isValid = this.chapaStrategy.verifyWebhookSignature(signature, body, rawBody);
    if (!isValid && process.env.NODE_ENV === 'production') {
      this.logger.warn(`Invalid Chapa webhook signature: [${signature}]`);
      return { status: 'ignored', reason: 'Invalid signature' };
    }

    // Extract transaction reference from multiple possible Chapa payload formats
    const txRef =
      body?.tx_ref ||
      body?.trx_ref ||
      body?.reference ||
      body?.data?.tx_ref ||
      body?.data?.trx_ref ||
      body?.data?.reference;

    const rawStatus = (body?.status || body?.data?.status || body?.event || '').toString().toLowerCase();

    if (!txRef) {
      this.logger.warn(`Chapa webhook received without a valid transaction reference: ${JSON.stringify(body)}`);
      return { status: 'acknowledged', message: 'No transaction reference found' };
    }

    // 1. Success event
    if (rawStatus === 'success' || rawStatus === 'charge.success' || rawStatus === 'completed') {
      this.logger.log(`Processing Chapa successful payment for reference: ${txRef}`);
      const updated = await this.paymentService.markPaymentCompletedByReference(txRef, body);
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
      const failureReason = body?.message || body?.data?.message || 'Chapa payment failed';
      const updated = await this.paymentService.markPaymentFailedByReference(txRef, failureReason, body);
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
