import { PaymentStatus, PaymentType } from '@prisma/client/financial';
import { DateRangeResult } from '../interfaces/analytics-query.interface';

function isCasePayment(paymentType?: string | null): boolean {
  return (
    paymentType === PaymentType.CASE_MILESTONE ||
    paymentType === PaymentType.CASE_PERCENTAGE ||
    paymentType === PaymentType.CASE_STAGE ||
    paymentType === PaymentType.CASE_SERVICE_REQUEST
  );
}

export function aggregateAdminAnalytics(
  payments: any[],
  refunds: any[],
  walletsCount: number,
  dateRange: DateRangeResult,
  period: string = 'all'
) {
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

  const byPaymentType: Record<
    string,
    { count: number; volumeETB: number; volumeUSD: number; commissionETB: number; commissionUSD: number }
  > = {};

  const byProvider: Record<
    string,
    {
      count: number;
      completedCount: number;
      grossVolumeETB: number;
      platformCommissionETB: number;
      netPayoutETB: number;
      grossVolumeUSD: number;
      platformCommissionUSD: number;
      netPayoutUSD: number;
      marketSharePercentage: number;
    }
  > = {};

  const attorneyRevenueMap: Record<
    string,
    { totalVolume: number; totalCommission: number; count: number }
  > = {};

  const timelineMap: Record<
    string,
    { date: string; grossETB: number; grossUSD: number; commissionETB: number; commissionUSD: number; txCount: number }
  > = {};

  let caseGrossETB = 0;
  let caseCommissionETB = 0;
  let caseCount = 0;

  let consultGrossETB = 0;
  let consultCommissionETB = 0;
  let consultCount = 0;

  for (const p of payments) {
    const amt = Number(p.amount || 0);
    const comm = Number(p.commission || 0);
    const net = Math.max(0, amt - comm);
    const curr = (p.currency || 'ETB').toUpperCase();
    const pType = p.paymentType || 'CONSULTATION_ONE_TIME';
    const provider = p.provider || 'CHAPA';

    if (p.payerId) uniquePayers.add(p.payerId);
    if (p.payeeId) uniquePayees.add(p.payeeId);

    if (!byPaymentType[pType]) {
      byPaymentType[pType] = { count: 0, volumeETB: 0, volumeUSD: 0, commissionETB: 0, commissionUSD: 0 };
    }
    byPaymentType[pType].count++;

    if (!byProvider[provider]) {
      byProvider[provider] = {
        count: 0,
        completedCount: 0,
        grossVolumeETB: 0,
        platformCommissionETB: 0,
        netPayoutETB: 0,
        grossVolumeUSD: 0,
        platformCommissionUSD: 0,
        netPayoutUSD: 0,
        marketSharePercentage: 0,
      };
    }
    byProvider[provider].count++;

    const isCase = isCasePayment(p.paymentType);
    if (isCase) caseCount++;
    else consultCount++;

    if (p.status === PaymentStatus.COMPLETED || p.status === PaymentStatus.REFUNDED) {
      if (p.status === PaymentStatus.COMPLETED) {
        byProvider[provider].completedCount++;
      }

      if (curr === 'USD') {
        totalGrossUSD += amt;
        totalCommissionUSD += comm;
        byPaymentType[pType].volumeUSD += amt;
        byPaymentType[pType].commissionUSD += comm;
        byProvider[provider].grossVolumeUSD += amt;
        byProvider[provider].platformCommissionUSD += comm;
        byProvider[provider].netPayoutUSD += net;
      } else {
        totalGrossETB += amt;
        totalCommissionETB += comm;
        byPaymentType[pType].volumeETB += amt;
        byPaymentType[pType].commissionETB += comm;
        byProvider[provider].grossVolumeETB += amt;
        byProvider[provider].platformCommissionETB += comm;
        byProvider[provider].netPayoutETB += net;

        if (isCase) {
          caseGrossETB += amt;
          caseCommissionETB += comm;
        } else {
          consultGrossETB += amt;
          consultCommissionETB += comm;
        }
      }

      if (p.payeeId) {
        if (!attorneyRevenueMap[p.payeeId]) {
          attorneyRevenueMap[p.payeeId] = { totalVolume: 0, totalCommission: 0, count: 0 };
        }
        attorneyRevenueMap[p.payeeId].totalVolume += amt;
        attorneyRevenueMap[p.payeeId].totalCommission += comm;
        attorneyRevenueMap[p.payeeId].count += 1;
      }

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

  const totalTransactionsAll = payments.length;
  for (const prov of Object.keys(byProvider)) {
    byProvider[prov].marketSharePercentage =
      totalTransactionsAll > 0
        ? Number(((byProvider[prov].count / totalTransactionsAll) * 100).toFixed(1))
        : 0;
  }

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
  const successRatePercentage =
    totalProcessed > 0 ? Number(((completedCount / totalProcessed) * 100).toFixed(2)) : 100;

  const trends = Object.values(timelineMap).sort((a, b) => a.date.localeCompare(b.date));

  return {
    success: true,
    timeframe: {
      period,
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
      commission: {
        totalPlatformCommissionETB: totalCommissionETB,
        totalPlatformCommissionUSD: totalCommissionUSD,
        effectiveCommissionRatePercentage:
          totalGrossETB > 0
            ? Number(((totalCommissionETB / totalGrossETB) * 100).toFixed(2))
            : 0,
        byCategory: {
          cases: {
            totalTransactions: caseCount,
            grossVolumeETB: caseGrossETB,
            platformCommissionETB: caseCommissionETB,
            netPayoutETB: Math.max(0, caseGrossETB - caseCommissionETB),
          },
          consultations: {
            totalTransactions: consultCount,
            grossVolumeETB: consultGrossETB,
            platformCommissionETB: consultCommissionETB,
            netPayoutETB: Math.max(0, consultGrossETB - consultCommissionETB),
          },
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
        averageTransactionValueETB:
          completedCount > 0 ? Math.round(totalGrossETB / completedCount) : 0,
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

export function aggregateAttorneyAnalytics(
  attorneyId: string,
  payments: any[],
  wallet: any,
  dateRange: DateRangeResult,
  period: string = 'all'
) {
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
  const timelineMap: Record<
    string,
    { date: string; gross: number; net: number; commission: number; txCount: number }
  > = {};

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

      if (!paymentTypeMap[pType]) {
        paymentTypeMap[pType] = { count: 0, gross: 0, net: 0 };
      }
      paymentTypeMap[pType].count++;
      paymentTypeMap[pType].gross += amt;
      paymentTypeMap[pType].net += net;

      if (p.caseId) {
        if (!caseRevenueMap[p.caseId]) {
          caseRevenueMap[p.caseId] = { caseId: p.caseId, volume: 0, count: 0 };
        }
        caseRevenueMap[p.caseId].volume += net;
        caseRevenueMap[p.caseId].count++;
      }

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
      period,
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

export function aggregateClientAnalytics(
  clientId: string,
  payments: any[],
  dateRange: DateRangeResult,
  period: string = 'all'
) {
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
  const timelineMap: Record<
    string,
    { date: string; amountSpentETB: number; amountSpentUSD: number; count: number }
  > = {};

  for (const p of payments) {
    const amt = Number(p.amount || 0);
    const curr = (p.currency || 'ETB').toUpperCase();
    const pType = p.paymentType || 'CONSULTATION_ONE_TIME';
    const provider = p.provider || 'CHAPA';

    if (p.payeeId) hiredAttorneys.add(p.payeeId);

    if (!byCategory[pType]) {
      byCategory[pType] = { count: 0, spentETB: 0, spentUSD: 0 };
    }
    byCategory[pType].count++;

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
      period,
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
