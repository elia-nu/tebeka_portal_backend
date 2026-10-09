import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PaymentStatus, LedgerEntryType } from '@prisma/client/financial';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PaymentCompletionService {
  private readonly logger = new Logger(PaymentCompletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async markPaymentCompleted(paymentId: string, approvedBy?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

      if (payment.status === PaymentStatus.COMPLETED) {
        return payment; // Idempotent no-op
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.COMPLETED,
          approvedBy: approvedBy || payment.payerId,
          approvedAt: new Date(),
          paidAt: new Date(),
        },
      });

      const netAmount = updated.amount.minus(updated.commission);
      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: LedgerEntryType.CREDIT,
          amount: updated.amount,
          balanceAfter: netAmount,
        },
      });

      if (updated.commission.greaterThan(0)) {
        await tx.ledgerEntry.create({
          data: {
            paymentId: updated.id,
            entryType: LedgerEntryType.COMMISSION,
            amount: updated.commission,
            balanceAfter: updated.commission,
          },
        });
      }

      if (updated.payeeId) {
        await tx.wallet.upsert({
          where: { userId: updated.payeeId },
          update: {
            pendingBalance: { increment: netAmount },
          },
          create: {
            userId: updated.payeeId,
            availableBalance: 0,
            pendingBalance: netAmount,
            currency: updated.currency,
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: updated.id,
          eventType: 'PAYMENT_COMPLETED',
          payload: {
            paymentId: updated.id,
            bookingId: updated.bookingId || null,
            caseId: updated.caseId || null,
            payerId: updated.payerId,
            payeeId: updated.payeeId,
            userId: updated.payerId,
            amount: Number(updated.amount),
            currency: updated.currency,
            status: 'COMPLETED',
            approvedBy: approvedBy || payment.payerId,
          },
        },
      });

      return updated;
    });
  }

  async markPaymentCompletedByReference(transactionReference: string, gatewayData?: any) {
    if (!transactionReference) return null;

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { transactionReference: String(transactionReference) },
          { stripePaymentId: String(transactionReference) },
          { id: String(transactionReference) },
        ],
      },
    });

    if (!payment) {
      this.logger.warn(`No payment found for transaction reference ${transactionReference}`);
      return null;
    }

    // If gateway provided additional payment ID (e.g. payment_intent), update stripePaymentId if missing
    const providerPaymentId = gatewayData?.id || gatewayData?.payment_intent || gatewayData?.transaction_id;
    if (providerPaymentId && !payment.stripePaymentId && (String(providerPaymentId).startsWith('cs_') || String(providerPaymentId).startsWith('pi_'))) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { stripePaymentId: String(providerPaymentId) },
      });
    }

    return this.markPaymentCompleted(payment.id, 'GATEWAY_WEBHOOK');
  }

  async markPaymentFailedByReference(transactionReference: string, reason?: string, gatewayData?: any) {
    if (!transactionReference) return null;

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { transactionReference: String(transactionReference) },
          { stripePaymentId: String(transactionReference) },
          { id: String(transactionReference) },
        ],
      },
    });

    if (!payment) {
      this.logger.warn(`No payment found to mark as failed for reference ${transactionReference}`);
      return null;
    }

    // Do not overwrite an already completed payment
    if (payment.status === PaymentStatus.COMPLETED) {
      this.logger.warn(`Payment ${payment.id} is already COMPLETED. Ignoring failure webhook for ${transactionReference}`);
      return payment;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: updated.id,
          eventType: 'PAYMENT_FAILED',
          payload: {
            paymentId: updated.id,
            bookingId: updated.bookingId || null,
            caseId: updated.caseId || null,
            payerId: updated.payerId,
            payeeId: updated.payeeId,
            userId: updated.payerId,
            amount: Number(updated.amount),
            currency: updated.currency,
            status: 'FAILED',
            reason: reason || 'Payment failed at gateway',
          },
        },
      });

      this.logger.log(`Payment [${payment.id}] (${transactionReference}) marked as FAILED. Reason: ${reason || 'Gateway failure'}`);
      return updated;
    });
  }
}
