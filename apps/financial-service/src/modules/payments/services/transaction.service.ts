import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PaymentStatus, PaymentProvider, PaymentType } from '@prisma/client/financial';
import { PrismaService } from '../../../database/prisma.service';

export interface TransactionFilterQuery {
  page?: number | string;
  limit?: number | string;
  pageSize?: number | string;
  perPage?: number | string;

  // Status filters
  status?: PaymentStatus | string;
  statuses?: string[] | string;

  // Provider filters
  provider?: PaymentProvider | string;
  providers?: string[] | string;
  paymentProvider?: PaymentProvider | string;

  // Type & category
  paymentType?: PaymentType | string;
  paymentTypes?: string[] | string;
  category?: 'CASE' | 'CONSULTATION' | 'ALL' | string;
  type?: string;

  // User / Party filters
  attorneyProfileId?: string;
  attorneyId?: string;
  clientId?: string;
  userId?: string;
  payerId?: string;
  payeeId?: string;
  requestedBy?: string;
  approvedBy?: string;

  // Entity association filters
  caseId?: string;
  caseIds?: string[] | string;
  bookingId?: string;
  bookingIds?: string[] | string;
  stage?: string;
  milestoneName?: string;

  // Reference & Gateway IDs
  transactionReference?: string;
  reference?: string;
  txRef?: string;
  stripePaymentId?: string;
  subaccountId?: string;

  // Amounts & Commission
  currency?: string;
  currencies?: string[] | string;
  minAmount?: number | string;
  maxAmount?: number | string;
  amount?: number | string;
  minCommission?: number | string;
  maxCommission?: number | string;
  commission?: number | string;

  // Date ranges
  startDate?: string;
  endDate?: string;
  from?: string;
  to?: string;
  createdStartDate?: string;
  createdEndDate?: string;
  paidStartDate?: string;
  paidEndDate?: string;
  paidFrom?: string;
  paidTo?: string;
  requestedStartDate?: string;
  requestedEndDate?: string;
  approvedStartDate?: string;
  approvedEndDate?: string;
  escrowReleasedStartDate?: string;
  escrowReleasedEndDate?: string;

  // Escrow & Refund status
  isEscrowReleased?: boolean | string;
  escrowReleased?: boolean | string;
  hasRefund?: boolean | string;
  refundStatus?: 'PENDING' | 'PROCESSED' | 'REJECTED' | string;

  // Search & Sorting
  search?: string;
  q?: string;
  query?: string;
  sortBy?: 'createdAt' | 'paidAt' | 'amount' | 'commission' | 'requestedAt' | 'approvedAt' | 'status' | 'provider' | 'paymentType' | 'updatedAt' | string;
  orderBy?: string;
  sort?: string;
  sortOrder?: 'asc' | 'desc' | 'ASC' | 'DESC';
  order?: 'asc' | 'desc' | 'ASC' | 'DESC';
}

export interface UserContext {
  userId: string;
  role?: 'ADMIN' | 'SUPER_ADMIN' | 'ATTORNEY' | 'CLIENT' | string;
  attorneyProfileId?: string;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // 1. ADMIN OVERALL TRANSACTIONS VIEW & ANALYTICS
  // =========================================================================

  /**
   * Retrieves overall platform transactions with full auditing, filters, and financial metrics.
   */
  async getAdminTransactions(query: TransactionFilterQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit || query.pageSize || query.perPage) || 20));
    const skip = (page - 1) * limit;

    const sortBy = this.getSortBy(query);
    const sortOrder = this.getSortOrder(query);

    const where = this.buildWhereClause(query);

    const [transactions, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          refunds: true,
          ledgerEntries: {
            orderBy: { createdAt: 'desc' },
          },
        },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    // Calculate aggregated overall financial metrics for Admin
    const allMatching = await this.prisma.payment.findMany({
      where,
      select: {
        amount: true,
        commission: true,
        currency: true,
        status: true,
        provider: true,
        paymentType: true,
        refunds: {
          select: { amount: true, status: true },
        },
      },
    });

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

    const providerBreakdown: Record<string, {
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
    }> = {};

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

    for (const tx of allMatching) {
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

      const isCase =
        tx.paymentType === PaymentType.CASE_MILESTONE ||
        tx.paymentType === PaymentType.CASE_PERCENTAGE ||
        tx.paymentType === PaymentType.CASE_STAGE ||
        tx.paymentType === PaymentType.CASE_SERVICE_REQUEST;

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

    const formattedTransactions = transactions.map((tx) => this.formatTransaction(tx));

    return {
      success: true,
      summary: {
        totalTransactions: total,
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
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      data: formattedTransactions,
    };
  }

  // =========================================================================
  // 2. ATTORNEY TRANSACTIONS VIEW (Incoming Client Payments & Net Payouts)
  // =========================================================================

  /**
   * Retrieves an attorney's incoming client payments, fee splits, and net wallet balance
   * with full support for case milestones, percentages, stages, and consultations.
   */
  async getAttorneyTransactions(attorneyId: string, query: TransactionFilterQuery = {}) {
    if (!attorneyId) {
      throw new NotFoundException('Attorney ID is required');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const candidateIds = Array.from(
      new Set(
        [attorneyId, query.attorneyProfileId, query.userId, query.payeeId, query.attorneyId]
          .filter(Boolean)
          .map((id) => String(id).trim())
      )
    );

    const where: any = {
      OR: [
        { payeeId: { in: candidateIds } },
        { requestedBy: { in: candidateIds } },
      ],
      ...this.buildWhereClause(query, true),
    };

    const [transactions, total, wallet] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          refunds: true,
          ledgerEntries: {
            orderBy: { createdAt: 'desc' },
          },
        },
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.wallet.findFirst({
        where: { userId: { in: candidateIds } },
      }),
    ]);

    // Aggregate Attorney specific metrics and Case vs Consultation breakdown
    const allAttorneyTxs = await this.prisma.payment.findMany({
      where,
      select: {
        amount: true,
        commission: true,
        currency: true,
        status: true,
        paymentType: true,
      },
    });

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

    for (const tx of allAttorneyTxs) {
      const amt = Number(tx.amount || 0);
      const comm = Number(tx.commission || 0);
      const curr = (tx.currency || 'ETB').toUpperCase();

      statusCounts[tx.status] = (statusCounts[tx.status] || 0) + 1;

      const isCase =
        tx.paymentType === PaymentType.CASE_MILESTONE ||
        tx.paymentType === PaymentType.CASE_PERCENTAGE ||
        tx.paymentType === PaymentType.CASE_STAGE ||
        tx.paymentType === PaymentType.CASE_SERVICE_REQUEST;

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

    const formattedTransactions = transactions.map((tx) => this.formatTransaction(tx));

    return {
      success: true,
      attorneyId,
      wallet: {
        availableBalance: Number(wallet?.availableBalance || 0),
        pendingBalance: Number(wallet?.pendingBalance || 0),
        currency: wallet?.currency || 'ETB',
        payoutMethod: wallet?.stripeAccountId
          ? 'STRIPE_CONNECT'
          : wallet?.chapaSubaccountId
          ? 'CHAPA_SPLIT'
          : 'MANUAL_BANK',
        bankName: wallet?.bankName,
        accountNumber: wallet?.accountNumber,
        stripeAccountStatus: wallet?.stripeAccountStatus,
        splitPercentage: wallet?.splitPercentage ?? 15.0,
      },
      summary: {
        totalTransactions: total,
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
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      data: formattedTransactions,
    };
  }

  // =========================================================================
  // 3. CLIENT TRANSACTIONS FLOW (Payments History & Outflow)
  // =========================================================================

  /**
   * Retrieves a client's transaction history, payment requests, receipts, and statuses.
   */
  async getClientTransactions(clientId: string, query: TransactionFilterQuery = {}) {
    if (!clientId) {
      throw new NotFoundException('Client ID is required');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const candidateIds = Array.from(
      new Set(
        [clientId, query.clientId, query.userId, query.payerId]
          .filter(Boolean)
          .map((id) => String(id).trim())
      )
    );

    const where: any = {
      payerId: { in: candidateIds },
      ...this.buildWhereClause(query, true),
    };

    const [transactions, total, wallet] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          refunds: true,
          ledgerEntries: {
            orderBy: { createdAt: 'desc' },
          },
        },
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.wallet.findFirst({
        where: { userId: { in: candidateIds } },
      }),
    ]);

    const allClientTxs = await this.prisma.payment.findMany({
      where,
      select: {
        amount: true,
        currency: true,
        status: true,
        paymentType: true,
        refunds: { select: { amount: true, status: true } },
      },
    });

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

    for (const tx of allClientTxs) {
      const amt = Number(tx.amount || 0);
      const curr = (tx.currency || 'ETB').toUpperCase();

      statusCounts[tx.status] = (statusCounts[tx.status] || 0) + 1;

      const isCase =
        tx.paymentType === PaymentType.CASE_MILESTONE ||
        tx.paymentType === PaymentType.CASE_PERCENTAGE ||
        tx.paymentType === PaymentType.CASE_STAGE ||
        tx.paymentType === PaymentType.CASE_SERVICE_REQUEST;

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

    const formattedTransactions = transactions.map((tx) => this.formatTransaction(tx));

    return {
      success: true,
      clientId,
      wallet: {
        availableBalance: Number(wallet?.availableBalance || 0),
        pendingBalance: Number(wallet?.pendingBalance || 0),
        currency: wallet?.currency || 'ETB',
        bankName: wallet?.bankName,
        accountNumber: wallet?.accountNumber,
      },
      summary: {
        totalTransactions: total,
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
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      data: formattedTransactions,
    };
  }

  // =========================================================================
  // 4. SINGLE TRANSACTION DETAILS & RECEIPT
  // =========================================================================

  /**
   * Retrieves single transaction details with role authorization.
   */
  async getTransactionDetails(identifier: string, user?: UserContext) {
    const transaction = await this.prisma.payment.findFirst({
      where: {
        OR: [{ id: identifier }, { transactionReference: identifier }],
      },
      include: {
        refunds: true,
        ledgerEntries: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction '${identifier}' not found`);
    }

    // Role check if user context is provided
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      const allowedIds = [user.userId, user.attorneyProfileId].filter(Boolean);
      const isOwner =
        allowedIds.includes(transaction.payerId) ||
        allowedIds.includes(transaction.payeeId) ||
        (transaction.requestedBy && allowedIds.includes(transaction.requestedBy));
      if (!isOwner) {
        throw new ForbiddenException('You do not have permission to view this transaction');
      }
    }

    return {
      success: true,
      data: this.formatTransaction(transaction, true),
    };
  }

  /**
   * Generates a structured printable/downloadable receipt payload.
   */
  async getTransactionReceipt(identifier: string, user?: UserContext) {
    const res = await this.getTransactionDetails(identifier, user);
    const tx = res.data;

    const receipt = {
      receiptNumber: `REC-${tx.transactionReference || tx.id.slice(0, 8).toUpperCase()}`,
      issuedDate: tx.paidAt || tx.createdAt,
      transactionReference: tx.transactionReference,
      status: tx.status,
      paymentMethod: tx.provider,
      currency: tx.currency,
      payerId: tx.payerId,
      payeeId: tx.payeeId,
      serviceDetails: {
        paymentType: tx.paymentType,
        description: tx.description || 'Legal consultation and representation services',
        caseId: tx.caseId || null,
        bookingId: tx.bookingId || null,
        milestoneName: tx.milestoneName || null,
        stage: tx.stage || null,
      },
      pricing: {
        grossAmount: tx.amount,
        commissionFee: tx.commission,
        netPayeeAmount: tx.netAmount,
        currency: tx.currency,
      },
      refund: tx.refunds && tx.refunds.length > 0 ? tx.refunds : null,
      merchant: {
        name: 'Tebeka Legal Services Platform',
        website: 'https://tebeka.et',
        supportEmail: 'support@tebeka.et',
      },
    };

    return {
      success: true,
      receipt,
    };
  }

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  private parseList(value?: string[] | string): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim()).filter(Boolean);
    }
    return String(value)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private parseBoolean(value?: boolean | string): boolean | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const str = String(value).trim().toLowerCase();
    if (['true', '1', 'yes'].includes(str)) return true;
    if (['false', '0', 'no'].includes(str)) return false;
    return undefined;
  }

  getSortBy(query: TransactionFilterQuery): string {
    const sort = (query.sortBy || query.orderBy || query.sort || 'createdAt').toString();
    const validSortFields = [
      'createdAt',
      'paidAt',
      'updatedAt',
      'amount',
      'commission',
      'status',
      'provider',
      'paymentType',
      'requestedAt',
      'approvedAt',
      'escrowReleasedAt',
      'transactionReference',
    ];
    return validSortFields.includes(sort) ? sort : 'createdAt';
  }

  getSortOrder(query: TransactionFilterQuery): 'asc' | 'desc' {
    const order = (query.sortOrder || query.order || 'desc').toString().toLowerCase();
    return order === 'asc' ? 'asc' : 'desc';
  }

  buildWhereClause(query: TransactionFilterQuery = {}, skipPayerPayee = false) {
    const where: any = {};
    const andConditions: any[] = [];

    // 1. User / Parties Filter
    if (!skipPayerPayee) {
      if (query.userId) {
        const uId = String(query.userId).trim();
        andConditions.push({
          OR: [
            { payerId: uId },
            { payeeId: uId },
            { requestedBy: uId },
            { approvedBy: uId },
          ],
        });
      }

      // Attorney / Payee candidates
      const candidatePayees = Array.from(
        new Set([
          ...this.parseList(query.payeeId),
          ...this.parseList(query.attorneyId),
          ...this.parseList(query.attorneyProfileId),
        ])
      );
      if (candidatePayees.length === 1) {
        andConditions.push({
          OR: [
            { payeeId: candidatePayees[0] },
            { requestedBy: candidatePayees[0] },
          ],
        });
      } else if (candidatePayees.length > 1) {
        andConditions.push({
          OR: [
            { payeeId: { in: candidatePayees } },
            { requestedBy: { in: candidatePayees } },
          ],
        });
      }

      // Client / Payer candidates
      const candidatePayers = Array.from(
        new Set([
          ...this.parseList(query.payerId),
          ...this.parseList(query.clientId),
        ])
      );
      if (candidatePayers.length === 1) {
        andConditions.push({
          OR: [
            { payerId: candidatePayers[0] },
            { approvedBy: candidatePayers[0] },
          ],
        });
      } else if (candidatePayers.length > 1) {
        andConditions.push({
          OR: [
            { payerId: { in: candidatePayers } },
            { approvedBy: { in: candidatePayers } },
          ],
        });
      }

      if (query.requestedBy) {
        const reqList = this.parseList(query.requestedBy);
        if (reqList.length === 1) where.requestedBy = reqList[0];
        else if (reqList.length > 1) where.requestedBy = { in: reqList };
      }

      if (query.approvedBy) {
        const appList = this.parseList(query.approvedBy);
        if (appList.length === 1) where.approvedBy = appList[0];
        else if (appList.length > 1) where.approvedBy = { in: appList };
      }
    }

    // 2. Status Filter
    const rawStatuses = [
      ...this.parseList(query.statuses),
      ...this.parseList(query.status as string),
    ];
    if (rawStatuses.length > 0) {
      const validStatuses = Object.values(PaymentStatus) as string[];
      const matchedStatuses = rawStatuses
        .map((s) => s.toUpperCase())
        .filter((s) => validStatuses.includes(s)) as PaymentStatus[];

      if (matchedStatuses.length === 1) {
        where.status = matchedStatuses[0];
      } else if (matchedStatuses.length > 1) {
        where.status = { in: matchedStatuses };
      }
    }

    // 3. Provider Filter
    const rawProviders = [
      ...this.parseList(query.providers),
      ...this.parseList(query.provider as string),
      ...this.parseList(query.paymentProvider as string),
    ];
    if (rawProviders.length > 0) {
      const validProviders = Object.values(PaymentProvider) as string[];
      const matchedProviders = rawProviders
        .map((p) => p.toUpperCase())
        .filter((p) => validProviders.includes(p)) as PaymentProvider[];

      if (matchedProviders.length === 1) {
        where.provider = matchedProviders[0];
      } else if (matchedProviders.length > 1) {
        where.provider = { in: matchedProviders };
      }
    }

    // 4. Payment Type & Category Filter
    const catUpper = (query.category || '').toString().trim().toUpperCase();
    const rawTypes = [
      ...this.parseList(query.paymentTypes),
      ...this.parseList(query.paymentType as string),
      ...this.parseList(query.type as string),
    ];

    const typeSet = new Set<PaymentType>();
    if (catUpper === 'CASE') {
      typeSet.add(PaymentType.CASE_MILESTONE);
      typeSet.add(PaymentType.CASE_PERCENTAGE);
      typeSet.add(PaymentType.CASE_STAGE);
      typeSet.add(PaymentType.CASE_SERVICE_REQUEST);
    } else if (catUpper === 'CONSULTATION') {
      typeSet.add(PaymentType.CONSULTATION_ONE_TIME);
    }

    const validPaymentTypes = Object.values(PaymentType) as string[];
    for (const t of rawTypes) {
      const tu = t.toUpperCase();
      if (tu === 'CASE') {
        typeSet.add(PaymentType.CASE_MILESTONE);
        typeSet.add(PaymentType.CASE_PERCENTAGE);
        typeSet.add(PaymentType.CASE_STAGE);
        typeSet.add(PaymentType.CASE_SERVICE_REQUEST);
      } else if (tu === 'CONSULTATION') {
        typeSet.add(PaymentType.CONSULTATION_ONE_TIME);
      } else if (validPaymentTypes.includes(tu)) {
        typeSet.add(tu as PaymentType);
      }
    }

    if (typeSet.size === 1) {
      where.paymentType = Array.from(typeSet)[0];
    } else if (typeSet.size > 1) {
      where.paymentType = { in: Array.from(typeSet) };
    }

    // 5. Currency Filter
    const rawCurrencies = [
      ...this.parseList(query.currencies),
      ...this.parseList(query.currency),
    ];
    if (rawCurrencies.length === 1) {
      where.currency = rawCurrencies[0].toUpperCase();
    } else if (rawCurrencies.length > 1) {
      where.currency = { in: rawCurrencies.map((c) => c.toUpperCase()) };
    }

    // 6. Entity association (caseId, bookingId, stage, milestoneName)
    const caseIds = [
      ...this.parseList(query.caseIds),
      ...this.parseList(query.caseId),
    ];
    if (caseIds.length === 1) where.caseId = caseIds[0];
    else if (caseIds.length > 1) where.caseId = { in: caseIds };

    const bookingIds = [
      ...this.parseList(query.bookingIds),
      ...this.parseList(query.bookingId),
    ];
    if (bookingIds.length === 1) where.bookingId = bookingIds[0];
    else if (bookingIds.length > 1) where.bookingId = { in: bookingIds };

    if (query.stage) {
      where.stage = { contains: String(query.stage).trim(), mode: 'insensitive' };
    }
    if (query.milestoneName) {
      where.milestoneName = { contains: String(query.milestoneName).trim(), mode: 'insensitive' };
    }

    // 7. References & Gateway IDs
    const ref = query.transactionReference || query.reference || query.txRef;
    if (ref) {
      where.transactionReference = { contains: String(ref).trim(), mode: 'insensitive' };
    }
    if (query.stripePaymentId) {
      where.stripePaymentId = { contains: String(query.stripePaymentId).trim(), mode: 'insensitive' };
    }
    if (query.subaccountId) {
      where.subaccountId = { contains: String(query.subaccountId).trim(), mode: 'insensitive' };
    }

    // 8. Amount & Commission Filters
    if (query.amount !== undefined && query.amount !== null && query.amount !== '') {
      where.amount = Number(query.amount);
    } else {
      if (query.minAmount !== undefined && query.minAmount !== null && query.minAmount !== '') {
        where.amount = { ...(where.amount || {}), gte: Number(query.minAmount) };
      }
      if (query.maxAmount !== undefined && query.maxAmount !== null && query.maxAmount !== '') {
        where.amount = { ...(where.amount || {}), lte: Number(query.maxAmount) };
      }
    }

    if (query.commission !== undefined && query.commission !== null && query.commission !== '') {
      where.commission = Number(query.commission);
    } else {
      if (query.minCommission !== undefined && query.minCommission !== null && query.minCommission !== '') {
        where.commission = { ...(where.commission || {}), gte: Number(query.minCommission) };
      }
      if (query.maxCommission !== undefined && query.maxCommission !== null && query.maxCommission !== '') {
        where.commission = { ...(where.commission || {}), lte: Number(query.maxCommission) };
      }
    }

    // 9. Timestamps / Date Ranges
    // createdAt
    const startCreated = query.startDate || query.from || query.createdStartDate;
    const endCreated = query.endDate || query.to || query.createdEndDate;
    if (startCreated || endCreated) {
      where.createdAt = {};
      if (startCreated) where.createdAt.gte = new Date(startCreated);
      if (endCreated) where.createdAt.lte = new Date(endCreated);
    }

    // paidAt
    const startPaid = query.paidStartDate || query.paidFrom;
    const endPaid = query.paidEndDate || query.paidTo;
    if (startPaid || endPaid) {
      where.paidAt = {};
      if (startPaid) where.paidAt.gte = new Date(startPaid);
      if (endPaid) where.paidAt.lte = new Date(endPaid);
    }

    // requestedAt
    if (query.requestedStartDate || query.requestedEndDate) {
      where.requestedAt = {};
      if (query.requestedStartDate) where.requestedAt.gte = new Date(query.requestedStartDate);
      if (query.requestedEndDate) where.requestedAt.lte = new Date(query.requestedEndDate);
    }

    // approvedAt
    if (query.approvedStartDate || query.approvedEndDate) {
      where.approvedAt = {};
      if (query.approvedStartDate) where.approvedAt.gte = new Date(query.approvedStartDate);
      if (query.approvedEndDate) where.approvedAt.lte = new Date(query.approvedEndDate);
    }

    // escrowReleasedAt
    if (query.escrowReleasedStartDate || query.escrowReleasedEndDate) {
      where.escrowReleasedAt = {};
      if (query.escrowReleasedStartDate) where.escrowReleasedAt.gte = new Date(query.escrowReleasedStartDate);
      if (query.escrowReleasedEndDate) where.escrowReleasedAt.lte = new Date(query.escrowReleasedEndDate);
    }

    // 10. Escrow & Refund status
    const escrowReleasedBool = this.parseBoolean(query.isEscrowReleased ?? query.escrowReleased);
    if (escrowReleasedBool !== undefined) {
      if (escrowReleasedBool) {
        where.escrowReleasedAt = { not: null };
      } else {
        where.escrowReleasedAt = null;
      }
    }

    const hasRefundBool = this.parseBoolean(query.hasRefund);
    if (hasRefundBool !== undefined) {
      if (hasRefundBool) {
        where.refunds = { some: {} };
      } else {
        where.refunds = { none: {} };
      }
    }

    if (query.refundStatus) {
      const refStatusUpper = String(query.refundStatus).trim().toUpperCase();
      where.refunds = { some: { status: refStatusUpper } };
    }

    // 11. Fuzzy / Global Search
    const searchTerm = (query.search || query.q || query.query || '').toString().trim();
    if (searchTerm) {
      andConditions.push({
        OR: [
          { transactionReference: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { milestoneName: { contains: searchTerm, mode: 'insensitive' } },
          { stage: { contains: searchTerm, mode: 'insensitive' } },
          { payerId: { contains: searchTerm, mode: 'insensitive' } },
          { payeeId: { contains: searchTerm, mode: 'insensitive' } },
          { requestedBy: { contains: searchTerm, mode: 'insensitive' } },
          { approvedBy: { contains: searchTerm, mode: 'insensitive' } },
          { caseId: { contains: searchTerm, mode: 'insensitive' } },
          { bookingId: { contains: searchTerm, mode: 'insensitive' } },
          { stripePaymentId: { contains: searchTerm, mode: 'insensitive' } },
          { subaccountId: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  private formatTransaction(tx: any, includeLedgers = false) {
    const amount = Number(tx.amount || 0);
    const commission = Number(tx.commission || 0);
    const netAmount = Math.max(0, amount - commission);

    return {
      id: tx.id,
      transactionReference: tx.transactionReference,
      stripePaymentId: tx.stripePaymentId,
      bookingId: tx.bookingId,
      caseId: tx.caseId,
      payerId: tx.payerId,
      payeeId: tx.payeeId,
      paymentType: tx.paymentType,
      amount,
      currency: tx.currency,
      commission,
      splitPercentage: tx.splitPercentage,
      netAmount,
      description: tx.description,
      provider: tx.provider,
      status: tx.status,
      requestedBy: tx.requestedBy,
      approvedBy: tx.approvedBy,
      milestoneName: tx.milestoneName,
      stage: tx.stage,
      percentage: tx.percentage,
      subaccountId: tx.subaccountId,
      requestedAt: tx.requestedAt,
      approvedAt: tx.approvedAt,
      paidAt: tx.paidAt,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
      refunds: tx.refunds || [],
      ...(includeLedgers && { ledgerEntries: tx.ledgerEntries || [] }),
    };
  }
}
