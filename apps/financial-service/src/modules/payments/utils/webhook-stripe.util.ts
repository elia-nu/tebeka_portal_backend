import { Logger } from '@nestjs/common';
import { PaymentService } from '../payment.service';
import { StripeStrategy } from '../strategies/stripe.strategy';

export async function processStripeWebhookEvent(
  paymentService: PaymentService,
  stripeStrategy: StripeStrategy,
  body: any,
  signature: string,
  req: any,
  logger: Logger
) {
  const rawBody = req?.rawBody;
  const event = stripeStrategy.constructEvent(signature, body, rawBody);

  if (!event && process.env.NODE_ENV === 'production') {
    logger.warn('Invalid Stripe webhook signature');
    return { status: 'ignored', reason: 'Invalid signature' };
  }

  // Use verified Stripe event or fallback to parsed body
  const eventData = event || body;
  const eventType = eventData?.type;
  const eventObject = eventData?.data?.object;

  logger.log(`📥 Received Stripe Webhook event: [${eventType}]`);

  // 1. Checkout Session Completed or Async Payment Succeeded
  if (
    eventType === 'checkout.session.completed' ||
    eventType === 'checkout.session.async_payment_succeeded'
  ) {
    const session = eventObject;
    const txRef =
      session?.client_reference_id ||
      session?.metadata?.txRef ||
      session?.metadata?.transactionReference ||
      session?.id;
    const isPaid =
      session?.payment_status === 'paid' ||
      session?.payment_status === 'no_payment_required' ||
      eventType === 'checkout.session.async_payment_succeeded';

    if (txRef && isPaid) {
      logger.log(`Processing Stripe Checkout completion for [${txRef}]`);
      const updated = await paymentService.markPaymentCompletedByReference(txRef, session);
      return {
        status: 'success',
        message: 'Payment marked as COMPLETED via Checkout Session',
        paymentId: updated?.id,
        reference: txRef,
      };
    } else if (txRef && session?.payment_status === 'unpaid') {
      logger.log(`Stripe Checkout Session [${txRef}] is still unpaid.`);
      return { status: 'pending', message: 'Checkout session payment pending' };
    }
  }

  // 2. Checkout Session Expired or Async Payment Failed
  if (
    eventType === 'checkout.session.expired' ||
    eventType === 'checkout.session.async_payment_failed'
  ) {
    const session = eventObject;
    const txRef = session?.client_reference_id || session?.metadata?.txRef || session?.id;
    if (txRef) {
      logger.warn(`Stripe Checkout Session [${txRef}] failed or expired.`);
      const updated = await paymentService.markPaymentFailedByReference(
        txRef,
        'Stripe Checkout Session expired or async payment failed',
        session
      );
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
    const txRef =
      intent?.metadata?.txRef ||
      intent?.metadata?.transactionReference ||
      intent?.metadata?.paymentId ||
      intent?.id;
    if (txRef) {
      logger.log(`Processing Stripe PaymentIntent success for [${txRef}]`);
      const updated = await paymentService.markPaymentCompletedByReference(txRef, intent);
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
    const txRef =
      intent?.metadata?.txRef || intent?.metadata?.transactionReference || intent?.id;
    const failureReason =
      intent?.last_payment_error?.message || intent?.cancellation_reason || 'Payment intent failed';
    if (txRef) {
      logger.warn(`Stripe PaymentIntent [${txRef}] failed: ${failureReason}`);
      const updated = await paymentService.markPaymentFailedByReference(
        txRef,
        failureReason,
        intent
      );
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
      logger.log(`Processing Stripe Charge success for [${txRef}]`);
      const updated = await paymentService.markPaymentCompletedByReference(txRef, charge);
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
      logger.warn(`Stripe Charge [${txRef}] failed: ${charge?.failure_message}`);
      const updated = await paymentService.markPaymentFailedByReference(
        txRef,
        charge?.failure_message || 'Charge failed',
        charge
      );
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
    logger.log(
      `Stripe Connect account updated: ${account?.id} (charges_enabled=${account?.charges_enabled}, details_submitted=${account?.details_submitted})`
    );
    return { status: 'acknowledged', event: 'account.updated', accountId: account?.id };
  }

  // 8. Default unhandled events
  logger.log(`Stripe event [${eventType}] acknowledged.`);
  return { status: 'acknowledged', event: eventType };
}
