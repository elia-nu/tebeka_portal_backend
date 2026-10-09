import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  AnalyticsPeriodQuery,
  DateRangeResult,
} from '../interfaces/analytics-query.interface';
import { resolveDateRange } from '../utils/analytics-date.util';
import {
  aggregateAdminAnalytics,
  aggregateAttorneyAnalytics,
  aggregateClientAnalytics,
} from '../utils/analytics-aggregators.util';

// Re-export interface for external consumers
export { AnalyticsPeriodQuery, DateRangeResult };

@Injectable()
export class FinancialAnalyticsService {
  private readonly logger = new Logger(FinancialAnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // 1. ADMIN PLATFORM FINANCIAL ANALYTICS
  // =========================================================================

  /**
   * Comprehensive platform-wide financial performance, trends, revenue streams, and conversion metrics.
   */
  async getAdminAnalytics(query: AnalyticsPeriodQuery = {}) {
    const dateRange = this.resolveDateRange(query);

    const where: any = {};
    if (dateRange.startDate || dateRange.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
      if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
    }

    const candidatePayees = [query.attorneyId, query.attorneyProfileId, query.userId]
      .filter(Boolean)
      .map((id) => String(id).trim());

    if (candidatePayees.length > 0) {
      where.OR = [
        { payeeId: { in: candidatePayees } },
        { requestedBy: { in: candidatePayees } },
      ];
    }

    const [payments, refunds, walletsCount] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          commission: true,
          currency: true,
          status: true,
          provider: true,
          paymentType: true,
          payerId: true,
          payeeId: true,
          createdAt: true,
          paidAt: true,
        },
      }),
      this.prisma.refund.findMany({
        where: {
          status: 'PROCESSED',
          ...(dateRange.startDate || dateRange.endDate
            ? {
                createdAt: {
                  ...(dateRange.startDate && { gte: dateRange.startDate }),
                  ...(dateRange.endDate && { lte: dateRange.endDate }),
                },
              }
            : {}),
        },
        select: {
          amount: true,
          payment: { select: { currency: true } },
          createdAt: true,
        },
      }),
      this.prisma.wallet.count(),
    ]);

    return aggregateAdminAnalytics(
      payments,
      refunds,
      walletsCount,
      dateRange,
      query.period || 'all'
    );
  }

  // =========================================================================
  // 2. ATTORNEY FINANCIAL ANALYTICS & EARNINGS BREAKDOWN
  // =========================================================================

  /**
   * Detailed attorney income trajectory, case revenue distribution, settlement status, and client counts.
   */
  async getAttorneyAnalytics(attorneyId: string, query: AnalyticsPeriodQuery = {}) {
    if (!attorneyId) {
      throw new NotFoundException('Attorney ID is required');
    }

    const dateRange = this.resolveDateRange(query);
    const candidateIds = Array.from(
      new Set(
        [attorneyId, query.attorneyProfileId, query.userId, query.attorneyId]
          .filter(Boolean)
          .map((id) => String(id).trim())
      )
    );

    const where: any = {
      OR: [
        { payeeId: { in: candidateIds } },
        { requestedBy: { in: candidateIds } },
      ],
    };

    if (dateRange.startDate || dateRange.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
      if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
    }

    const [payments, wallet] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          amount: true,
          commission: true,
          currency: true,
          status: true,
          provider: true,
          paymentType: true,
          payerId: true,
          caseId: true,
          bookingId: true,
          createdAt: true,
          paidAt: true,
        },
      }),
      this.prisma.wallet.findFirst({
        where: { userId: { in: candidateIds } },
      }),
    ]);

    return aggregateAttorneyAnalytics(
      attorneyId,
      payments,
      wallet,
      dateRange,
      query.period || 'all'
    );
  }

  // =========================================================================
  // 3. CLIENT FINANCIAL ANALYTICS & EXPENSE TRACKING
  // =========================================================================

  /**
   * Client financial summary, expenditures per legal case/consultation, payment method stats, and refund tracking.
   */
  async getClientAnalytics(clientId: string, query: AnalyticsPeriodQuery = {}) {
    if (!clientId) {
      throw new NotFoundException('Client ID is required');
    }

    const dateRange = this.resolveDateRange(query);

    const where: any = { payerId: clientId };
    if (dateRange.startDate || dateRange.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
      if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
    }

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        refunds: true,
      },
    });

    return aggregateClientAnalytics(
      clientId,
      payments,
      dateRange,
      query.period || 'all'
    );
  }

  // =========================================================================
  // HELPER METHOD (Preserved for internal and testing usage)
  // =========================================================================

  resolveDateRange(query: AnalyticsPeriodQuery): DateRangeResult {
    return resolveDateRange(query);
  }
}
