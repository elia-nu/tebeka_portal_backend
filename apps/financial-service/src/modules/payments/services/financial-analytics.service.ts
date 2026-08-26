import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient, PaymentStatus, PaymentType, PaymentProvider } from '@prisma/client/financial';

const prisma = new PrismaClient();

export interface AnalyticsPeriodQuery {
  period?: '7d' | '30d' | '90d' | '12m' | 'all';
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class FinancialAnalyticsService {
  private readonly logger = new Logger(FinancialAnalyticsService.name);

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

    const [payments, refunds, walletsCount] = await Promise.all([
      prisma.payment.findMany({
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
      prisma.refund.findMany({
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
      prisma.wallet.count(),
    ]);

    // Financial KPIs
    let totalGrossETB = 0;
    let totalGrossUSD = 0;
    let totalCommissionETB = 0;
    let totalCommissionUSD = 0;
    let totalRefundedETB = 0;
    let totalRefundedUSD = 0;

    let completedCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let refundedCount = 0;

    const uniquePayers = new Set<string>();
    const uniquePayees = new Set<string>();

    const byPaymentType: Record<string, { count: number; volumeETB: number; volumeUSD: number }> = {};
    const byProvider: Record<string, { count: number; volumeETB: number; volumeUSD: number }> = {};
    const attorneyRevenueMap: Record<string, { totalVolume: number; totalCommission: number; count: number }> = {};

    // Grouping by Date for Trend chart
    const timelineMap: Record<string, { date: string; grossETB: number; grossUSD: number; commissionETB: number; commissionUSD: number; txCount: number }> = {};

    for (const p of payments) {
      const amt = Number(p.amount || 0);
      const comm = Number(p.commission || 0);
      const curr = (p.currency || 'ETB').toUpperCase();
      const pType = p.paymentType || 'CONSULTATION_ONE_TIME';
      const provider = p.provider || 'CHAPA';

      if (p.payerId) uniquePayers.add(p.payerId);
      if (p.payeeId) uniquePayees.add(p.payeeId);

      // Payment Type Breakdown
      if (!byPaymentType[pType]) {
        byPaymentType[pType] = { count: 0, volumeETB: 0, volumeUSD: 0 };
      }
      byPaymentType[pType].count++;

      // Provider Breakdown
      if (!byProvider[provider]) {
        byProvider[provider] = { count: 0, volumeETB: 0, volumeUSD: 0 };
      }
      byProvider[provider].count++;

      if (p.status === PaymentStatus.COMPLETED || p.status === PaymentStatus.REFUNDED) {
        if (curr === 'USD') {
          totalGrossUSD += amt;
          totalCommissionUSD += comm;
          byPaymentType[pType].volumeUSD += amt;
          byProvider[provider].volumeUSD += amt;
        } else {
          totalGrossETB += amt;
          totalCommissionETB += comm;
          byPaymentType[pType].volumeETB += amt;
          byProvider[provider].volumeETB += amt;
        }

        if (p.payeeId) {
          if (!attorneyRevenueMap[p.payeeId]) {
            attorneyRevenueMap[p.payeeId] = { totalVolume: 0, totalCommission: 0, count: 0 };
          }
          attorneyRevenueMap[p.payeeId].totalVolume += amt;
          attorneyRevenueMap[p.payeeId].totalCommission += comm;
          attorneyRevenueMap[p.payeeId].count += 1;
        }

        // Timeline Bucket
        const dateKey = (p.paidAt || p.createdAt).toISOString().split('T')[0];
        if (!timelineMap[dateKey]) {
          timelineMap[dateKey] = { date: dateKey, grossETB: 0, grossUSD: 0, commissionETB: 0, commissionUSD: 0, txCount: 0 };
        }
        if (curr === 'USD') {
          timelineMap[dateKey].grossUSD += amt;
          timelineMap[dateKey].commissionUSD += comm;
        } else {
          timelineMap[dateKey].grossETB += amt;
          timelineMap[dateKey].commissionETB += comm;
        }
        timelineMap[dateKey].txCount++;
      }

      if (p.status === PaymentStatus.COMPLETED) completedCount++;
      else if (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING) pendingCount++;
      else if (p.status === PaymentStatus.FAILED) failedCount++;
      else if (p.status === PaymentStatus.REFUNDED) refundedCount++;
    }

    for (const ref of refunds) {
      const refAmt = Number(ref.amount || 0);
      const curr = (ref.payment?.currency || 'ETB').toUpperCase();
      if (curr === 'USD') totalRefundedUSD += refAmt;
      else totalRefundedETB += refAmt;
    }

    // Top 5 Attorneys by Platform Volume
    const topAttorneys = Object.entries(attorneyRevenueMap)
      .map(([attorneyId, stats]) => ({
        attorneyId,
        grossVolume: stats.totalVolume,
        commissionGenerated: stats.totalCommission,
        netPayout: Math.max(0, stats.totalVolume - stats.totalCommission),
        completedTransactions: stats.count,
      }))
      .sort((a, b) => b.grossVolume - a.grossVolume)
      .slice(0, 10);

    const totalProcessed = completedCount + failedCount + refundedCount;
    const successRatePercentage = totalProcessed > 0 ? Number(((completedCount / totalProcessed) * 100).toFixed(2)) : 100;

    // Timeline array sorted ascending
    const trends = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      timeframe: {
        period: query.period || 'all',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      kpis: {
        revenue: {
          ETB: {
            grossVolume: totalGrossETB,
            platformRevenue: totalCommissionETB,
            netAttorneyPayouts: Math.max(0, totalGrossETB - totalCommissionETB),
            refunded: totalRefundedETB,
          },
          USD: {
            grossVolume: totalGrossUSD,
            platformRevenue: totalCommissionUSD,
            netAttorneyPayouts: Math.max(0, totalGrossUSD - totalCommissionUSD),
            refunded: totalRefundedUSD,
          },
        },
        transactions: {
          total: payments.length,
          completed: completedCount,
          pending: pendingCount,
          failed: failedCount,
          refunded: refundedCount,
          successRatePercentage,
        },
        activity: {
          uniqueClientsCount: uniquePayers.size,
          activeAttorneysCount: uniquePayees.size,
          registeredWalletsCount: walletsCount,
          averageTransactionValueETB: completedCount > 0 ? Math.round(totalGrossETB / completedCount) : 0,
        },
      },
      breakdowns: {
        byPaymentType,
        byProvider,
      },
      topAttorneys,
      trends,
    };
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

    const where: any = {
      OR: [{ payeeId: attorneyId }, { requestedBy: attorneyId }],
    };

    if (dateRange.startDate || dateRange.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
      if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
    }

    const [payments, wallet] = await Promise.all([
      prisma.payment.findMany({
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
      prisma.wallet.findUnique({ where: { userId: attorneyId } }),
    ]);

    let totalGrossETB = 0;
    let totalGrossUSD = 0;
    let totalCommissionETB = 0;
    let totalCommissionUSD = 0;

    let completedCount = 0;
    let pendingCount = 0;
    let refundedCount = 0;

    const uniqueClients = new Set<string>();
    const caseRevenueMap: Record<string, { caseId: string; volume: number; count: number }> = {};
    const paymentTypeMap: Record<string, { count: number; gross: number; net: number }> = {};
    const timelineMap: Record<string, { date: string; gross: number; net: number; commission: number; txCount: number }> = {};

    for (const p of payments) {
      const amt = Number(p.amount || 0);
      const comm = Number(p.commission || 0);
      const net = Math.max(0, amt - comm);
      const curr = (p.currency || 'ETB').toUpperCase();
      const pType = p.paymentType || 'CONSULTATION_ONE_TIME';

      if (p.payerId) uniqueClients.add(p.payerId);

      if (p.status === PaymentStatus.COMPLETED) {
        completedCount++;

        if (curr === 'USD') {
          totalGrossUSD += amt;
          totalCommissionUSD += comm;
        } else {
          totalGrossETB += amt;
          totalCommissionETB += comm;
        }

        // By Service Type
        if (!paymentTypeMap[pType]) {
          paymentTypeMap[pType] = { count: 0, gross: 0, net: 0 };
        }
        paymentTypeMap[pType].count++;
        paymentTypeMap[pType].gross += amt;
        paymentTypeMap[pType].net += net;

        // By Case
        if (p.caseId) {
          if (!caseRevenueMap[p.caseId]) {
            caseRevenueMap[p.caseId] = { caseId: p.caseId, volume: 0, count: 0 };
          }
          caseRevenueMap[p.caseId].volume += net;
          caseRevenueMap[p.caseId].count++;
        }

        // Timeline
        const dateKey = (p.paidAt || p.createdAt).toISOString().split('T')[0];
        if (!timelineMap[dateKey]) {
          timelineMap[dateKey] = { date: dateKey, gross: 0, net: 0, commission: 0, txCount: 0 };
        }
        timelineMap[dateKey].gross += amt;
        timelineMap[dateKey].net += net;
        timelineMap[dateKey].commission += comm;
        timelineMap[dateKey].txCount++;
      } else if (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING) {
        pendingCount++;
      } else if (p.status === PaymentStatus.REFUNDED) {
        refundedCount++;
      }
    }

    const topCases = Object.values(caseRevenueMap)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    const trends = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      attorneyId,
      timeframe: {
        period: query.period || 'all',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      wallet: {
        availableBalance: Number(wallet?.availableBalance || 0),
        pendingEscrowBalance: Number(wallet?.pendingBalance || 0),
        currency: wallet?.currency || 'ETB',
        splitPercentage: wallet?.splitPercentage ?? 15.0,
      },
      earnings: {
        ETB: {
          grossEarnings: totalGrossETB,
          platformCommissionDeducted: totalCommissionETB,
          netTakeHome: Math.max(0, totalGrossETB - totalCommissionETB),
        },
        USD: {
          grossEarnings: totalGrossUSD,
          platformCommissionDeducted: totalCommissionUSD,
          netTakeHome: Math.max(0, totalGrossUSD - totalCommissionUSD),
        },
      },
      metrics: {
        totalClientsServed: uniqueClients.size,
        totalCompletedCases: Object.keys(caseRevenueMap).length,
        completedTransactions: completedCount,
        pendingTransactions: pendingCount,
        refundedTransactions: refundedCount,
        averageDealSizeETB: completedCount > 0 ? Math.round(totalGrossETB / completedCount) : 0,
      },
      serviceBreakdown: paymentTypeMap,
      topCases,
      trends,
    };
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

    const payments = await prisma.payment.findMany({
      where,
      include: {
        refunds: true,
      },
    });

    let totalSpentETB = 0;
    let totalSpentUSD = 0;
    let totalRefundedETB = 0;
    let totalRefundedUSD = 0;

    let completedCount = 0;
    let pendingCount = 0;
    let refundedCount = 0;

    const hiredAttorneys = new Set<string>();
    const byCategory: Record<string, { count: number; spentETB: number; spentUSD: number }> = {};
    const byProvider: Record<string, { count: number; totalSpent: number }> = {};
    const timelineMap: Record<string, { date: string; amountSpentETB: number; amountSpentUSD: number; count: number }> = {};

    for (const p of payments) {
      const amt = Number(p.amount || 0);
      const curr = (p.currency || 'ETB').toUpperCase();
      const pType = p.paymentType || 'CONSULTATION_ONE_TIME';
      const provider = p.provider || 'CHAPA';

      if (p.payeeId) hiredAttorneys.add(p.payeeId);

      // Category breakdown
      if (!byCategory[pType]) {
        byCategory[pType] = { count: 0, spentETB: 0, spentUSD: 0 };
      }
      byCategory[pType].count++;

      // Provider breakdown
      if (!byProvider[provider]) {
        byProvider[provider] = { count: 0, totalSpent: 0 };
      }
      byProvider[provider].count++;

      if (p.status === PaymentStatus.COMPLETED || p.status === PaymentStatus.REFUNDED) {
        if (curr === 'USD') {
          totalSpentUSD += amt;
          byCategory[pType].spentUSD += amt;
        } else {
          totalSpentETB += amt;
          byCategory[pType].spentETB += amt;
        }
        byProvider[provider].totalSpent += amt;

        // Timeline
        const dateKey = (p.paidAt || p.createdAt).toISOString().split('T')[0];
        if (!timelineMap[dateKey]) {
          timelineMap[dateKey] = { date: dateKey, amountSpentETB: 0, amountSpentUSD: 0, count: 0 };
        }
        if (curr === 'USD') {
          timelineMap[dateKey].amountSpentUSD += amt;
        } else {
          timelineMap[dateKey].amountSpentETB += amt;
        }
        timelineMap[dateKey].count++;
      }

      if (p.status === PaymentStatus.COMPLETED) completedCount++;
      else if (p.status === PaymentStatus.PENDING || p.status === PaymentStatus.PROCESSING) pendingCount++;
      else if (p.status === PaymentStatus.REFUNDED) refundedCount++;

      if (p.refunds) {
        for (const ref of p.refunds) {
          if (ref.status === 'PROCESSED') {
            const refAmt = Number(ref.amount || 0);
            if (curr === 'USD') totalRefundedUSD += refAmt;
            else totalRefundedETB += refAmt;
          }
        }
      }
    }

    const trends = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      clientId,
      timeframe: {
        period: query.period || 'all',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      summary: {
        totalSpent: {
          ETB: {
            grossSpent: totalSpentETB,
            refunded: totalRefundedETB,
            netExpenditure: Math.max(0, totalSpentETB - totalRefundedETB),
          },
          USD: {
            grossSpent: totalSpentUSD,
            refunded: totalRefundedUSD,
            netExpenditure: Math.max(0, totalSpentUSD - totalRefundedUSD),
          },
        },
        transactions: {
          total: payments.length,
          completed: completedCount,
          pending: pendingCount,
          refunded: refundedCount,
        },
        hiredAttorneysCount: hiredAttorneys.size,
      },
      categoryBreakdown: byCategory,
      paymentMethodBreakdown: byProvider,
      spendingTrends: trends,
    };
  }

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  private resolveDateRange(query: AnalyticsPeriodQuery): { startDate?: Date; endDate?: Date } {
    if (query.startDate || query.endDate) {
      return {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      };
    }

    const now = new Date();
    if (query.period === '7d') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      return { startDate: past, endDate: now };
    }
    if (query.period === '30d') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      return { startDate: past, endDate: now };
    }
    if (query.period === '90d') {
      const past = new Date(now);
      past.setDate(past.getDate() - 90);
      return { startDate: past, endDate: now };
    }
    if (query.period === '12m') {
      const past = new Date(now);
      past.setFullYear(past.getFullYear() - 1);
      return { startDate: past, endDate: now };
    }

    return {};
  }
}
