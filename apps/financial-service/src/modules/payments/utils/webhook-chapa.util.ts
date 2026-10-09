import { Logger } from '@nestjs/common';
import { PaymentService } from '../payment.service';
import { ChapaStrategy } from '../strategies/chapa.strategy';

export async function processChapaWebhookEvent(
  paymentService: PaymentService,
  chapaStrategy: ChapaStrategy,
  body: any,
  rawSig: string,
  req: any,
  logger: Logger
) {
  const query = req?.query || {};
  const mergedData = { ...query, ...(body || {}) };
  logger.log(`📥 Received Chapa Webhook/Callback [${req?.method}]: ${JSON.stringify(mergedData)}`);

  const signature =
    rawSig ||
    req?.headers?.['x-chapa-signature'] ||
    req?.headers?.['chapa-signature'] ||
    req?.headers?.['x-signature'];
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

  let rawStatus = (
    mergedData?.status ||
    mergedData?.data?.status ||
    mergedData?.event ||
    ''
  )
    .toString()
    .toLowerCase();

  // Verify webhook signature if present or in production for POST
  if (signature) {
    const isValid = chapaStrategy.verifyWebhookSignature(signature, body || mergedData, rawBody);
    if (!isValid && process.env.NODE_ENV === 'production') {
      logger.warn(`Invalid Chapa webhook signature: [${signature}]`);
      return { status: 'ignored', reason: 'Invalid signature' };
    }
  } else if (req?.method === 'GET' && txRef && rawStatus === 'success') {
    // For GET browser redirect/callbacks without webhook header, verify directly against Chapa's verify API
    try {
      const verifyRes = await chapaStrategy.verifyPayment(txRef);
      if (verifyRes.status !== 'COMPLETED') {
        logger.warn(`Chapa verifyPayment check returned ${verifyRes.status} for [${txRef}]`);
        rawStatus = verifyRes.status.toLowerCase();
      }
    } catch (err: any) {
      logger.warn(`Chapa direct verification note for [${txRef}]: ${err.message}`);
    }
  }

  if (!txRef) {
    logger.warn(
      `Chapa webhook received without a valid transaction reference: ${JSON.stringify(mergedData)}`
    );
    return { status: 'acknowledged', message: 'No transaction reference found' };
  }

  // 1. Success event
  if (rawStatus === 'success' || rawStatus === 'charge.success' || rawStatus === 'completed') {
    logger.log(`Processing Chapa successful payment for reference: ${txRef}`);
    const updated = await paymentService.markPaymentCompletedByReference(txRef, mergedData);
    if (!updated) {
      logger.warn(`Chapa payment reference not found in database: ${txRef}`);
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
    logger.warn(`Processing Chapa payment failure for reference: ${txRef}`);
    const failureReason =
      mergedData?.message || mergedData?.data?.message || 'Chapa payment failed';
    const updated = await paymentService.markPaymentFailedByReference(
      txRef,
      failureReason,
      mergedData
    );
    return {
      status: 'failed',
      message: 'Payment marked as FAILED',
      paymentId: updated?.id,
      reference: txRef,
    };
  }

  logger.log(`Chapa webhook acknowledged with status: ${rawStatus} for ${txRef}`);
  return { status: 'acknowledged', message: `Status '${rawStatus}' acknowledged` };
}
