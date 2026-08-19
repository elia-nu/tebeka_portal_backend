import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/financial';

const prisma = new PrismaClient();

@Injectable()
export class PaymentRefundService {
  async getRefunds(query?: { status?: any; payeeId?: string; payerId?: string }) {
    return prisma.refund.findMany({
      where: {
        ...(query?.status && { status: query.status }),
        ...(query?.payeeId && { payment: { payeeId: query.payeeId } }),
        ...(query?.payerId && { payment: { payerId: query.payerId } }),
      },
      include: {
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processManualRefund(refundId: string, processedBy: string, notes?: string) {
    return prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
        include: { payment: true },
      });

      if (!refund) throw new NotFoundException(`Refund ${refundId} not found`);
      if (refund.status === 'PROCESSED') {
        throw new BadRequestException('Refund has already been processed');
      }

      const refundAmount = Number(refund.amount);

      // 1. Credit client available balance
      const clientWallet = await tx.wallet.upsert({
        where: { userId: refund.payment.payerId },
        update: { availableBalance: { increment: refundAmount } },
        create: { userId: refund.payment.payerId, availableBalance: refundAmount },
      });

      // 2. Decrement attorney pending balance
      const attorneyPendingDeduction =
        (refundAmount * (100 - (refund.payment.splitPercentage || 15))) / 100;
      await tx.wallet.upsert({
        where: { userId: refund.payment.payeeId },
        update: { pendingBalance: { decrement: attorneyPendingDeduction } },
        create: { userId: refund.payment.payeeId, availableBalance: 0, pendingBalance: 0 },
      });

      // 3. Mark Refund as PROCESSED
      const updatedRefund = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'PROCESSED',
          reason: notes ? `${refund.reason || ''} | Note: ${notes}` : refund.reason,
        },
      });

      // 4. Record Ledger Entry
      await tx.ledgerEntry.create({
        data: {
          paymentId: refund.paymentId,
          entryType: 'REFUND',
          amount: refundAmount,
          balanceAfter: clientWallet.availableBalance,
        },
      });

      // 5. Update Payment status
      await tx.payment.update({
        where: { id: refund.paymentId },
        data: { status: 'REFUNDED' },
      });

      // 6. Emit Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Refund',
          aggregateId: refund.id,
          eventType: 'PAYMENT_REFUNDED',
          payload: {
            refundId: refund.id,
            paymentId: refund.paymentId,
            payerId: refund.payment.payerId,
            payeeId: refund.payment.payeeId,
            refundAmount,
            processedBy,
            notes,
          },
        },
      });

      return updatedRefund;
    });
  }

  async rejectManualRefund(refundId: string, rejectedBy: string, reason: string) {
    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException(`Refund ${refundId} not found`);

    return prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        reason: `${refund.reason || ''} | Rejected by ${rejectedBy}: ${reason}`,
      },
    });
  }
}
