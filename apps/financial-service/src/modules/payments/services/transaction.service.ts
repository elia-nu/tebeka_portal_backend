import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  TransactionFilterQuery,
  UserContext,
  FormattedTransaction,
} from '../interfaces/transaction-query.interface';
import {
  resolveSortBy,
  resolveSortOrder,
  buildTransactionWhereClause,
  formatTransaction,
} from '../utils/transaction-filter.util';
import {
  calculateAdminTransactionMetrics,
  calculateAttorneyEarningsMetrics,
  calculateClientSpendMetrics,
} from '../utils/transaction-metrics.util';

// Re-export interfaces for external consumers
export { TransactionFilterQuery, UserContext, FormattedTransaction };

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
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit || query.pageSize || query.perPage) || 20)
    );
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

    // Aggregate overall metrics across all matching transactions
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

    const metrics = calculateAdminTransactionMetrics(allMatching);
    const formattedTransactions = transactions.map((tx) => this.formatTransaction(tx));

    return {
      success: true,
      summary: {
        totalTransactions: total,
        ...metrics,
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
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit || query.pageSize || query.perPage) || 20)
    );
    const skip = (page - 1) * limit;

    const sortBy = this.getSortBy(query);
    const sortOrder = this.getSortOrder(query);

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
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.wallet.findFirst({
        where: { userId: { in: candidateIds } },
      }),
    ]);

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

    const metrics = calculateAttorneyEarningsMetrics(allAttorneyTxs);
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
        ...metrics,
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
    const limit = Math.min(
      100,
      Math.max(1, Number(query.limit || query.pageSize || query.perPage) || 20)
    );
    const skip = (page - 1) * limit;

    const sortBy = this.getSortBy(query);
    const sortOrder = this.getSortOrder(query);

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
          [sortBy]: sortOrder,
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

    const metrics = calculateClientSpendMetrics(allClientTxs);
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
        ...metrics,
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
  // HELPER DELEGATIONS (Preserves direct method access and test coverage)
  // =========================================================================

  getSortBy(query: TransactionFilterQuery): string {
    return resolveSortBy(query);
  }

  getSortOrder(query: TransactionFilterQuery): 'asc' | 'desc' {
    return resolveSortOrder(query);
  }

  buildWhereClause(query: TransactionFilterQuery = {}, skipPayerPayee = false) {
    return buildTransactionWhereClause(query, skipPayerPayee);
  }

  formatTransaction(tx: any, includeLedgers = false): FormattedTransaction {
    return formatTransaction(tx, includeLedgers);
  }
}
