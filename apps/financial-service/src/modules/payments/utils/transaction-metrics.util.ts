import { PaymentType } from '@prisma/client/financial';

export interface AdminMetricsResult {
  volume: {
    ETB: {
      gross: number;
      platformCommission: number;
      netAttorneyPayout: number;
      refunded: number;
    };
    USD: {
      gross: number;
      platformCommission: number;
      netAttorneyPayout: number;
      refunded: number;
    };
  };
  commissionStats: {
    totalCommissionETB: number;
    totalCommissionUSD: number;
    effectiveCommissionRatePercentage: number;
  };
  breakdownByProvider: Record<
    string,
    {
      totalTransactions: number;
      completedCount: number;
      grossVolumeETB: number;
      platformCommissionETB: number;
      netPayoutETB: number;
      grossVolumeUSD: number;
      platformCommissionUSD: number;
      netPayoutUSD: number;
      refundedETB: number;
      refundedUSD: number;
    }
  >;
  breakdownByCategory: {
    cases: {
      totalTransactions: number;
      grossVolumeETB: number;
      platformCommissionETB: number;
      netPayoutETB: number;
      grossVolumeUSD: number;
      platformCommissionUSD: number;
      netPayoutUSD: number;
    };
    consultations: {
      totalTransactions: number;
      grossVolumeETB: number;
      platformCommissionETB: number;
      netPayoutETB: number;
      grossVolumeUSD: number;
      platformCommissionUSD: number;
      netPayoutUSD: number;
    };
  };
  statusCounts: Record<string, number>;
}

export interface AttorneyMetricsResult {
  earnings: {
    ETB: {
      gross: number;
      commissionDeducted: number;
      netEarned: number;
    };
    USD: {
      gross: number;
      commissionDeducted: number;
      netEarned: number;
    };
  };
  breakdownByCategory: {
    cases: {
      totalTransactions: number;
      grossETB: number;
      commissionETB: number;
      netEarnedETB: number;
      grossUSD: number;
      netEarnedUSD: number;
    };
    consultations: {
      totalTransactions: number;
      grossETB: number;
      commissionETB: number;
      netEarnedETB: number;
      grossUSD: number;
      netEarnedUSD: number;
    };
  };
  statusCounts: Record<string, number>;
}

export interface ClientMetricsResult {
  spent: {
    ETB: {
      totalSpent: number;
      refunded: number;
      netPaid: number;
    };
    USD: {
      totalSpent: number;
      refunded: number;
      netPaid: number;
    };
  };
  breakdownByCategory: {
    cases: {
      totalTransactions: number;
      totalSpentETB: number;
      totalSpentUSD: number;
    };
    consultations: {
      totalTransactions: number;
      totalSpentETB: number;
      totalSpentUSD: number;
    };
  };
  statusCounts: Record<string, number>;
}

function isCasePayment(paymentType?: string | null): boolean {
  return (
    paymentType === PaymentType.CASE_MILESTONE ||
    paymentType === PaymentType.CASE_PERCENTAGE ||
    paymentType === PaymentType.CASE_STAGE ||
    paymentType === PaymentType.CASE_SERVICE_REQUEST
  );
}

export function calculateAdminTransactionMetrics(payments: any[]): AdminMetricsResult {
  let totalVolumeETB = 0;
  let totalVolumeUSD = 0;
  let totalCommissionETB = 0;
  let totalCommissionUSD = 0;
  let totalRefundedETB = 0;
  let totalRefundedUSD = 0;

  const statusCounts: Record<string, number> = {
    COMPLETED: 0,
    PENDING: 0,
    PROCESSING: 0,
    FAILED: 0,
    REFUNDED: 0,
  };

  const providerBreakdown: Record<
    string,
    {
      totalTransactions: number;
      completedCount: number;
      grossVolumeETB: number;
      platformCommissionETB: number;
      netPayoutETB: number;
      grossVolumeUSD: number;
      platformCommissionUSD: number;
      netPayoutUSD: number;
      refundedETB: number;
      refundedUSD: number;
    }
  > = {};

  let casesCount = 0;
  let caseGrossETB = 0;
  let caseCommissionETB = 0;
  let caseGrossUSD = 0;
  let caseCommissionUSD = 0;

  let consultationsCount = 0;
  let consultGrossETB = 0;
  let consultCommissionETB = 0;
  let consultGrossUSD = 0;
  let consultCommissionUSD = 0;

  for (const tx of payments) {
    const amt = Number(tx.amount || 0);
    const comm = Number(tx.commission || 0);
    const curr = (tx.currency || 'ETB').toUpperCase();
    const provider = tx.provider || 'CHAPA';

    statusCounts[tx.status] = (statusCounts[tx.status] || 0) + 1;

    if (!providerBreakdown[provider]) {
      providerBreakdown[provider] = {
        totalTransactions: 0,
        completedCount: 0,
        grossVolumeETB: 0,
        platformCommissionETB: 0,
        netPayoutETB: 0,
        grossVolumeUSD: 0,
        platformCommissionUSD: 0,
        netPayoutUSD: 0,
        refundedETB: 0,
        refundedUSD: 0,
      };
    }
    providerBreakdown[provider].totalTransactions += 1;

    const isCase = isCasePayment(tx.paymentType);
    if (isCase) {
      casesCount++;
    } else {
      consultationsCount++;
    }

    if (tx.status === 'COMPLETED' || tx.status === 'REFUNDED') {
      if (tx.status === 'COMPLETED') {
        providerBreakdown[provider].completedCount += 1;
      }

      if (curr === 'USD') {
        totalVolumeUSD += amt;
        totalCommissionUSD += comm;
        providerBreakdown[provider].grossVolumeUSD += amt;
        providerBreakdown[provider].platformCommissionUSD += comm;
        providerBreakdown[provider].netPayoutUSD += Math.max(0, amt - comm);
        if (isCase) {
          caseGrossUSD += amt;
          caseCommissionUSD += comm;
        } else {
          consultGrossUSD += amt;
          consultCommissionUSD += comm;
        }
      } else {
        totalVolumeETB += amt;
        totalCommissionETB += comm;
        providerBreakdown[provider].grossVolumeETB += amt;
        providerBreakdown[provider].platformCommissionETB += comm;
        providerBreakdown[provider].netPayoutETB += Math.max(0, amt - comm);
        if (isCase) {
          caseGrossETB += amt;
          caseCommissionETB += comm;
        } else {
          consultGrossETB += amt;
          consultCommissionETB += comm;
        }
      }
    }

    if (tx.refunds) {
      for (const ref of tx.refunds) {
        if (ref.status === 'PROCESSED') {
          const refAmt = Number(ref.amount || 0);
          if (curr === 'USD') {
            totalRefundedUSD += refAmt;
            providerBreakdown[provider].refundedUSD += refAmt;
          } else {
            totalRefundedETB += refAmt;
            providerBreakdown[provider].refundedETB += refAmt;
          }
        }
      }
    }
  }

  return {
    volume: {
      ETB: {
        gross: totalVolumeETB,
        platformCommission: totalCommissionETB,
        netAttorneyPayout: Math.max(0, totalVolumeETB - totalCommissionETB),
        refunded: totalRefundedETB,
      },
      USD: {
        gross: totalVolumeUSD,
        platformCommission: totalCommissionUSD,
        netAttorneyPayout: Math.max(0, totalVolumeUSD - totalCommissionUSD),
        refunded: totalRefundedUSD,
      },
    },
    commissionStats: {
      totalCommissionETB,
      totalCommissionUSD,
      effectiveCommissionRatePercentage:
        totalVolumeETB > 0
          ? Number(((totalCommissionETB / totalVolumeETB) * 100).toFixed(2))
          : 0,
    },
    breakdownByProvider: providerBreakdown,
    breakdownByCategory: {
      cases: {
        totalTransactions: casesCount,
        grossVolumeETB: caseGrossETB,
        platformCommissionETB: caseCommissionETB,
        netPayoutETB: Math.max(0, caseGrossETB - caseCommissionETB),
        grossVolumeUSD: caseGrossUSD,
        platformCommissionUSD: caseCommissionUSD,
        netPayoutUSD: Math.max(0, caseGrossUSD - caseCommissionUSD),
      },
      consultations: {
        totalTransactions: consultationsCount,
        grossVolumeETB: consultGrossETB,
        platformCommissionETB: consultCommissionETB,
        netPayoutETB: Math.max(0, consultGrossETB - consultCommissionETB),
        grossVolumeUSD: consultGrossUSD,
        platformCommissionUSD: consultCommissionUSD,
        netPayoutUSD: Math.max(0, consultGrossUSD - consultCommissionUSD),
      },
    },
    statusCounts,
  };
}

export function calculateAttorneyEarningsMetrics(payments: any[]): AttorneyMetricsResult {
  let totalGrossEarnedETB = 0;
  let totalGrossEarnedUSD = 0;
  let totalCommissionDeductedETB = 0;
  let totalCommissionDeductedUSD = 0;

  let casesCount = 0;
  let caseGrossETB = 0;
  let caseCommETB = 0;
  let caseGrossUSD = 0;
  let caseCommUSD = 0;

  let consultationsCount = 0;
  let consultGrossETB = 0;
  let consultCommETB = 0;
  let consultGrossUSD = 0;
  let consultCommUSD = 0;

  const statusCounts: Record<string, number> = {
    COMPLETED: 0,
    PENDING: 0,
    PROCESSING: 0,
    FAILED: 0,
    REFUNDED: 0,
  };

  for (const tx of payments) {
    const amt = Number(tx.amount || 0);
    const comm = Number(tx.commission || 0);
    const curr = (tx.currency || 'ETB').toUpperCase();

    statusCounts[tx.status] = (statusCounts[tx.status] || 0) + 1;

    const isCase = isCasePayment(tx.paymentType);
    if (isCase) {
      casesCount++;
    } else {
      consultationsCount++;
    }

    if (tx.status === 'COMPLETED') {
      if (curr === 'USD') {
        totalGrossEarnedUSD += amt;
        totalCommissionDeductedUSD += comm;
        if (isCase) {
          caseGrossUSD += amt;
          caseCommUSD += comm;
        } else {
          consultGrossUSD += amt;
          consultCommUSD += comm;
        }
      } else {
        totalGrossEarnedETB += amt;
        totalCommissionDeductedETB += comm;
        if (isCase) {
          caseGrossETB += amt;
          caseCommETB += comm;
        } else {
          consultGrossETB += amt;
          consultCommETB += comm;
        }
      }
    }
  }

  return {
    earnings: {
      ETB: {
        gross: totalGrossEarnedETB,
        commissionDeducted: totalCommissionDeductedETB,
        netEarned: Math.max(0, totalGrossEarnedETB - totalCommissionDeductedETB),
      },
      USD: {
        gross: totalGrossEarnedUSD,
        commissionDeducted: totalCommissionDeductedUSD,
        netEarned: Math.max(0, totalGrossEarnedUSD - totalCommissionDeductedUSD),
      },
    },
    breakdownByCategory: {
      cases: {
        totalTransactions: casesCount,
        grossETB: caseGrossETB,
        commissionETB: caseCommETB,
        netEarnedETB: Math.max(0, caseGrossETB - caseCommETB),
        grossUSD: caseGrossUSD,
        netEarnedUSD: Math.max(0, caseGrossUSD - caseCommUSD),
      },
      consultations: {
        totalTransactions: consultationsCount,
        grossETB: consultGrossETB,
        commissionETB: consultCommETB,
        netEarnedETB: Math.max(0, consultGrossETB - consultCommETB),
        grossUSD: consultGrossUSD,
        netEarnedUSD: Math.max(0, consultGrossUSD - consultCommUSD),
      },
    },
    statusCounts,
  };
}

export function calculateClientSpendMetrics(payments: any[]): ClientMetricsResult {
  let totalSpentETB = 0;
  let totalSpentUSD = 0;
  let totalRefundedETB = 0;
  let totalRefundedUSD = 0;

  let casesCount = 0;
  let caseSpentETB = 0;
  let caseSpentUSD = 0;

  let consultationsCount = 0;
  let consultSpentETB = 0;
  let consultSpentUSD = 0;

  const statusCounts: Record<string, number> = {
    COMPLETED: 0,
    PENDING: 0,
    PROCESSING: 0,
    FAILED: 0,
    REFUNDED: 0,
  };

  for (const tx of payments) {
    const amt = Number(tx.amount || 0);
    const curr = (tx.currency || 'ETB').toUpperCase();

    statusCounts[tx.status] = (statusCounts[tx.status] || 0) + 1;

    const isCase = isCasePayment(tx.paymentType);
    if (isCase) {
      casesCount++;
    } else {
      consultationsCount++;
    }

    if (tx.status === 'COMPLETED' || tx.status === 'REFUNDED') {
      if (curr === 'USD') {
        totalSpentUSD += amt;
        if (isCase) caseSpentUSD += amt;
        else consultSpentUSD += amt;
      } else {
        totalSpentETB += amt;
        if (isCase) caseSpentETB += amt;
        else consultSpentETB += amt;
      }
    }

    if (tx.refunds) {
      for (const ref of tx.refunds) {
        if (ref.status === 'PROCESSED') {
          const refAmt = Number(ref.amount || 0);
          if (curr === 'USD') {
            totalRefundedUSD += refAmt;
          } else {
            totalRefundedETB += refAmt;
          }
        }
      }
    }
  }

  return {
    spent: {
      ETB: {
        totalSpent: totalSpentETB,
        refunded: totalRefundedETB,
        netPaid: Math.max(0, totalSpentETB - totalRefundedETB),
      },
      USD: {
        totalSpent: totalSpentUSD,
        refunded: totalRefundedUSD,
        netPaid: Math.max(0, totalSpentUSD - totalRefundedUSD),
      },
    },
    breakdownByCategory: {
      cases: {
        totalTransactions: casesCount,
        totalSpentETB: caseSpentETB,
        totalSpentUSD: caseSpentUSD,
      },
      consultations: {
        totalTransactions: consultationsCount,
        totalSpentETB: consultSpentETB,
        totalSpentUSD: consultSpentUSD,
      },
    },
    statusCounts,
  };
}
