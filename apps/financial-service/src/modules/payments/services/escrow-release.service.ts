import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentStatus, LedgerEntryType } from '@prisma/client/financial';
import { PrismaService } from '../../../database/prisma.service';

export interface EscrowReleaseResult {
  success: boolean;
  paymentId: string;
  payeeId: string;
  netAmount: number;
  currency: string;
  releasedAt: Date;
}

@Injectable()
export class EscrowReleaseService {
  private readonly logger = new Logger(EscrowReleaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Release escrow for a completed consultation booking
   */
  async releaseEscrowForBooking(bookingId: string, approvedBy?: string): Promise<{
    success: boolean;
    releasedCount: number;
    releases: EscrowReleaseResult[];
    message: string;
  }> {
    if (!bookingId) {
      throw new BadRequestException('bookingId is required for escrow release');
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        bookingId,
        status: PaymentStatus.COMPLETED,
        escrowReleasedAt: null,
      },
    });

    if (!payments || payments.length === 0) {
      this.logger.log(`No unreleased completed escrow payments found for booking [${bookingId}].`);
      return {
        success: true,
        releasedCount: 0,
        releases: [],
        message: 'No pending escrow release required for this booking.',
      };
    }

    const releases: EscrowReleaseResult[] = [];
    for (const payment of payments) {
      const result = await this.executeEscrowRelease(payment, approvedBy || 'BOOKING_COMPLETION');
      releases.push(result);
    }

    this.logger.log(`Successfully released escrow for booking [${bookingId}]: ${releases.length} payment(s).`);
    return {
      success: true,
      releasedCount: releases.length,
      releases,
      message: `Escrow successfully released for booking ${bookingId}.`,
    };
  }

  /**
   * 2. Release escrow for an acknowledged case milestone
   */
  async releaseEscrowForMilestone(
    caseId: string,
    milestoneName?: string,
    approvedBy?: string
  ): Promise<{
    success: boolean;
    releasedCount: number;
    releases: EscrowReleaseResult[];
    message: string;
  }> {
    if (!caseId) {
      throw new BadRequestException('caseId is required for milestone escrow release');
    }

    // Try finding by caseId + milestoneName first
    let payments = await this.prisma.payment.findMany({
      where: {
        caseId,
        ...(milestoneName ? { milestoneName } : {}),
        status: PaymentStatus.COMPLETED,
        escrowReleasedAt: null,
      },
    });

    // Fallback: If milestoneName didn't match directly, check for any unreleased completed payment on this case
    if ((!payments || payments.length === 0) && milestoneName) {
      payments = await this.prisma.payment.findMany({
        where: {
          caseId,
          status: PaymentStatus.COMPLETED,
          escrowReleasedAt: null,
        },
      });
    }

    if (!payments || payments.length === 0) {
      this.logger.log(`No unreleased completed escrow payments found for case [${caseId}], milestone: [${milestoneName || 'ALL'}].`);
      return {
        success: true,
        releasedCount: 0,
        releases: [],
        message: 'No pending escrow release required for this milestone.',
      };
    }

    const releases: EscrowReleaseResult[] = [];
    for (const payment of payments) {
      const result = await this.executeEscrowRelease(payment, approvedBy || 'MILESTONE_ACKNOWLEDGED');
      releases.push(result);
    }

    this.logger.log(`Successfully released milestone escrow for case [${caseId}]: ${releases.length} payment(s).`);
    return {
      success: true,
      releasedCount: releases.length,
      releases,
      message: `Escrow successfully released for case milestone ${milestoneName || caseId}.`,
    };
  }

  /**
   * 3. Release escrow directly by payment ID
   */
  async releaseEscrowByPaymentId(paymentId: string, approvedBy?: string): Promise<EscrowReleaseResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment [${paymentId}] not found`);
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(`Cannot release escrow for payment [${paymentId}] in ${payment.status} status`);
    }

    if (payment.escrowReleasedAt) {
      return {
        success: true,
        paymentId: payment.id,
        payeeId: payment.payeeId,
        netAmount: Number(payment.amount.minus(payment.commission)),
        currency: payment.currency,
        releasedAt: payment.escrowReleasedAt,
      };
    }

    return this.executeEscrowRelease(payment, approvedBy || 'MANUAL_RELEASE');
  }

  /**
   * 4. Reconcile all completed transactions whose escrow is stuck in pendingBalance
   */
  async reconcileStuckEscrow(targetPayeeId?: string, approvedBy: string = 'ESCROW_RECONCILIATION'): Promise<{
    success: boolean;
    reconciledCount: number;
    totalReleasedETB: number;
    totalReleasedUSD: number;
    releases: EscrowReleaseResult[];
    message: string;
  }> {
    const where: any = {
      status: PaymentStatus.COMPLETED,
      escrowReleasedAt: null,
      ...(targetPayeeId ? { payeeId: targetPayeeId } : {}),
    };

    const unreleasedPayments = await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    let totalReleasedETB = 0;
    let totalReleasedUSD = 0;
    const releases: EscrowReleaseResult[] = [];

    for (const payment of unreleasedPayments) {
      const res = await this.executeEscrowRelease(payment, approvedBy);
      releases.push(res);
      if (res.currency === 'USD') {
        totalReleasedUSD += res.netAmount;
      } else {
        totalReleasedETB += res.netAmount;
      }
    }

    this.logger.log(
      `Reconciled ${releases.length} stuck escrow payments. Released: ${totalReleasedETB.toFixed(2)} ETB, $${totalReleasedUSD.toFixed(2)} USD.`
    );

    return {
      success: true,
      reconciledCount: releases.length,
      totalReleasedETB,
      totalReleasedUSD,
      releases,
      message: `Successfully reconciled ${releases.length} completed transactions and released escrow to available balance.`,
    };
  }

  /**
   * Internal Core: Atomically shifts funds from pendingBalance to availableBalance
   */
  private async executeEscrowRelease(payment: any, approvedBy: string): Promise<EscrowReleaseResult> {
    const netDecimal = payment.amount.minus(payment.commission);
    const netAmount = Number(netDecimal);
    const releasedAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      // 1. Stamp payment record as escrow released
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          escrowReleasedAt: releasedAt,
          approvedBy: approvedBy || payment.approvedBy,
          updatedAt: releasedAt,
        },
      });

      // 2. Atomically adjust payee wallet balances
      let balanceAfter = netAmount;
      if (updatedPayment.payeeId) {
        const wallet = await tx.wallet.findUnique({
          where: { userId: updatedPayment.payeeId },
        });

        const currentPending = Number(wallet?.pendingBalance || 0);
        const currentAvailable = Number(wallet?.availableBalance || 0);
        const newPending = Math.max(0, currentPending - netAmount);
        const newAvailable = currentAvailable + netAmount;
        balanceAfter = newAvailable;

        await tx.wallet.upsert({
          where: { userId: updatedPayment.payeeId },
          update: {
            pendingBalance: newPending,
            availableBalance: newAvailable,
          },
          create: {
            userId: updatedPayment.payeeId,
            availableBalance: netAmount,
            pendingBalance: 0,
            currency: updatedPayment.currency,
          },
        });
      }

      // 3. Record double-entry Ledger record for payout/escrow release audit
      await tx.ledgerEntry.create({
        data: {
          paymentId: updatedPayment.id,
          entryType: LedgerEntryType.PAYOUT,
          amount: netDecimal,
          balanceAfter,
        },
      });

      // 4. Record transactional outbox event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: updatedPayment.id,
          eventType: 'ESCROW_RELEASED',
          payload: {
            paymentId: updatedPayment.id,
            bookingId: updatedPayment.bookingId || null,
            caseId: updatedPayment.caseId || null,
            payerId: updatedPayment.payerId,
            payeeId: updatedPayment.payeeId,
            netAmount,
            commission: Number(updatedPayment.commission),
            currency: updatedPayment.currency,
            releasedAt,
            approvedBy,
          },
        },
      });

      this.logger.log(
        `[ESCROW RELEASED] Payment [${updatedPayment.id}]: Transferred ${netAmount} ${updatedPayment.currency} to Attorney [${updatedPayment.payeeId}] Available Balance.`
      );

      return {
        success: true,
        paymentId: updatedPayment.id,
        payeeId: updatedPayment.payeeId,
        netAmount,
        currency: updatedPayment.currency,
        releasedAt,
      };
    });
  }
}
