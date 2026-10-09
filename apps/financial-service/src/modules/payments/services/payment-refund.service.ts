import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PaymentRefundService {
  constructor(private readonly prisma: PrismaService) {}
  async getRefunds(query?: {
    status?: any;
    payeeId?: string;
    payerId?: string;
    paymentId?: string;
    page?: number | string;
    limit?: number | string;
    pageSize?: number | string;
    perPage?: number | string;
    startDate?: string;
    endDate?: string;
    search?: string;
    q?: string;
    query?: string;
    sortBy?: 'createdAt' | 'amount' | 'status' | 'processedAt' | 'rejectedAt' | 'updatedAt' | string;
    orderBy?: string;
    sort?: string;
    sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
    order?: 'asc' | 'desc' | 'ASC' | 'DESC';
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit || query?.pageSize || query?.perPage) || 20));
    const skip = (page - 1) * limit;

    const sortField = (query?.sortBy || query?.orderBy || query?.sort || 'createdAt').toString();
    const validSortFields = ['createdAt', 'amount', 'status', 'processedAt', 'rejectedAt', 'updatedAt'];
    const sortBy = validSortFields.includes(sortField) ? sortField : 'createdAt';
    const sortOrder = (query?.sortOrder || query?.order || 'desc').toString().toLowerCase() === 'asc' ? 'asc' : 'desc';

    const where: any = {
      ...(query?.status && { status: query.status }),
      ...(query?.paymentId && { paymentId: query.paymentId }),
      ...(query?.payeeId && { payment: { payeeId: query.payeeId } }),
      ...(query?.payerId && { payment: { payerId: query.payerId } }),
    };

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const searchTerm = (query?.search || query?.q || query?.query || '').toString().trim();
    if (searchTerm) {
      where.OR = [
        { reason: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { paymentId: { contains: searchTerm, mode: 'insensitive' } },
        { processedBy: { contains: searchTerm, mode: 'insensitive' } },
        { payment: { transactionReference: { contains: searchTerm, mode: 'insensitive' } } },
        { payment: { payerId: { contains: searchTerm, mode: 'insensitive' } } },
        { payment: { payeeId: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: {
          payment: true,
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      data: refunds,
    };
  }

  async processManualRefund(refundId: string, processedBy: string, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
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
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException(`Refund ${refundId} not found`);

    return this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        reason: `${refund.reason || ''} | Rejected by ${rejectedBy}: ${reason}`,
      },
    });
  }
}
