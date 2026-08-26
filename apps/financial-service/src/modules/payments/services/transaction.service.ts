import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaClient, PaymentStatus, PaymentProvider, PaymentType } from '@prisma/client/financial';

const prisma = new PrismaClient();

export interface TransactionFilterQuery {
  page?: number | string;
  limit?: number | string;
  status?: PaymentStatus;
  provider?: PaymentProvider;
  paymentType?: PaymentType;
  currency?: string;
  payerId?: string;
  payeeId?: string;
  caseId?: string;
  bookingId?: string;
  minAmount?: number | string;
  maxAmount?: number | string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'createdAt' | 'paidAt' | 'amount' | 'commission';
  sortOrder?: 'asc' | 'desc';
}

export interface UserContext {
  userId: string;
  role?: 'ADMIN' | 'SUPER_ADMIN' | 'ATTORNEY' | 'CLIENT' | string;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  // =========================================================================
  // 1. ADMIN OVERALL TRANSACTIONS VIEW & ANALYTICS
  // =========================================================================

  /**
   * Retrieves overall platform transactions with full auditing, filters, and financial metrics.
   */
  async getAdminTransactions(query: TransactionFilterQuery = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(query);

    const [transactions, total] = await Promise.all([
      prisma.payment.findMany({
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
      prisma.payment.count({ where }),
    ]);

    // Calculate aggregated overall financial metrics for Admin
    const allMatching = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        commission: true,
        currency: true,
        status: true,
        provider: true,
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

    const providerCounts: Record<string, number> = {};

    for (const tx of allMatching) {
      const amt = Number(tx.amount || 0);
      const comm = Number(tx.commission || 0);
      const curr = (tx.currency || 'ETB').toUpperCase();

      statusCounts[tx.status] = (statusCounts[tx.status] || 0) + 1;
      providerCounts[tx.provider] = (providerCounts[tx.provider] || 0) + 1;

      if (tx.status === 'COMPLETED' || tx.status === 'REFUNDED') {
        if (curr === 'USD') {
          totalVolumeUSD += amt;
          totalCommissionUSD += comm;
        } else {
          totalVolumeETB += amt;
          totalCommissionETB += comm;
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
        statusCounts,
        providerCounts,
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
   * Retrieves an attorney's incoming client payments, fee splits, and net wallet balance.
   */
  async getAttorneyTransactions(attorneyId: string, query: TransactionFilterQuery = {}) {
    if (!attorneyId) {
      throw new NotFoundException('Attorney ID is required');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [{ payeeId: attorneyId }, { requestedBy: attorneyId }],
      ...this.buildWhereClause(query, true),
    };

    const [transactions, total, wallet] = await Promise.all([
      prisma.payment.findMany({
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
      prisma.payment.count({ where }),
      prisma.wallet.findUnique({ where: { userId: attorneyId } }),
    ]);

    // Aggregate Attorney specific metrics
    const allAttorneyTxs = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        commission: true,
        currency: true,
        status: true,
      },
    });

    let totalGrossEarnedETB = 0;
    let totalGrossEarnedUSD = 0;
    let totalCommissionDeductedETB = 0;
    let totalCommissionDeductedUSD = 0;

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

      if (tx.status === 'COMPLETED') {
        if (curr === 'USD') {
          totalGrossEarnedUSD += amt;
          totalCommissionDeductedUSD += comm;
        } else {
          totalGrossEarnedETB += amt;
          totalCommissionDeductedETB += comm;
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

    const where: any = {
      payerId: clientId,
      ...this.buildWhereClause(query, true),
    };

    const [transactions, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          refunds: true,
        },
        skip,
        take: limit,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
      }),
      prisma.payment.count({ where }),
    ]);

    const allClientTxs = await prisma.payment.findMany({
      where,
      select: {
        amount: true,
        currency: true,
        status: true,
        refunds: { select: { amount: true, status: true } },
      },
    });

    let totalSpentETB = 0;
    let totalSpentUSD = 0;
    let totalRefundedETB = 0;
    let totalRefundedUSD = 0;

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

      if (tx.status === 'COMPLETED' || tx.status === 'REFUNDED') {
        if (curr === 'USD') {
          totalSpentUSD += amt;
        } else {
          totalSpentETB += amt;
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
    const transaction = await prisma.payment.findFirst({
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
      const isOwner =
        transaction.payerId === user.userId ||
        transaction.payeeId === user.userId ||
        transaction.requestedBy === user.userId;
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

  private buildWhereClause(query: TransactionFilterQuery, skipPayerPayee = false) {
    const where: any = {};

    if (!skipPayerPayee) {
      if (query.payerId) where.payerId = query.payerId;
      if (query.payeeId) where.payeeId = query.payeeId;
    }

    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.paymentType) where.paymentType = query.paymentType;
    if (query.currency) where.currency = query.currency.toUpperCase();
    if (query.caseId) where.caseId = query.caseId;
    if (query.bookingId) where.bookingId = query.bookingId;

    if (query.minAmount !== undefined && query.minAmount !== null && query.minAmount !== '') {
      where.amount = { ...(where.amount || {}), gte: Number(query.minAmount) };
    }
    if (query.maxAmount !== undefined && query.maxAmount !== null && query.maxAmount !== '') {
      where.amount = { ...(where.amount || {}), lte: Number(query.maxAmount) };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { transactionReference: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { milestoneName: { contains: term, mode: 'insensitive' } },
        { payerId: { contains: term, mode: 'insensitive' } },
        { payeeId: { contains: term, mode: 'insensitive' } },
        { caseId: { contains: term, mode: 'insensitive' } },
        { bookingId: { contains: term, mode: 'insensitive' } },
      ];
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
