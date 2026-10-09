import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PaymentStatus, PaymentType, PaymentProvider } from '@prisma/client/financial';
import { PrismaService } from '../../database/prisma.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';
import { PaymentRefundService } from './services/payment-refund.service';
import { PayoutWalletService } from './services/payout-wallet.service';
import { GeoPaymentService, GeoGatewayResolution } from './services/geo-payment.service';
import { PaymentCompletionService } from './services/payment-completion.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly completionService: PaymentCompletionService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chapaStrategy: ChapaStrategy,
    private readonly stripeStrategy: StripeStrategy,
    private readonly refundService: PaymentRefundService,
    private readonly walletService: PayoutWalletService,
    private readonly geoPaymentService: GeoPaymentService,
    @Optional() paymentCompletionService?: PaymentCompletionService,
  ) {
    this.completionService = paymentCompletionService || new PaymentCompletionService(this.prisma);
  }


  // =========================================================================
  // 1. GEO GATEWAY DETECTION
  // =========================================================================

  detectGateway(clientIp: string, overrideCountry?: string): GeoGatewayResolution {
    return this.geoPaymentService.resolveGateway(clientIp, overrideCountry);
  }

  // =========================================================================
  // 2. PAYMENT CREATION & CHECKOUT
  // =========================================================================

  async createPayment(data: any, userId: string, clientIp: string = '127.0.0.1') {
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Valid positive amount is required');
    if (!data.payeeId) throw new BadRequestException('payeeId is required');

    const paymentType = data.paymentType || (data.caseId ? PaymentType.CASE_MILESTONE : PaymentType.CONSULTATION_ONE_TIME);

    // Dynamic Geo-Routing: If provider or currency is not provided, detect via geoip-lite
    let provider = data.provider as PaymentProvider;
    let currency = data.currency;

    if (!provider || !currency) {
      const geoResolved = this.geoPaymentService.resolveGateway(clientIp, data.country);
      provider = provider || (geoResolved.provider as PaymentProvider);
      currency = currency || geoResolved.currency;
      this.logger.log(`Geo-detected payment route: ${provider} (${currency}) for IP [${clientIp}]`);
    }

    const txRef = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Lookup payee wallet & Admin configured commission
    const payeeWallet = await this.prisma.wallet.findUnique({ where: { userId: data.payeeId } });
    const globalDefaultCommission = await this.walletService.getGlobalPlatformCommission();
    const splitPercentage = payeeWallet?.splitPercentage ?? globalDefaultCommission;
    const calculatedCommission = (Number(data.amount) * splitPercentage) / 100;
    const subaccountId = provider === PaymentProvider.STRIPE
      ? payeeWallet?.stripeAccountId || null
      : payeeWallet?.chapaSubaccountId || null;

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          bookingId: data.bookingId || null,
          caseId: data.caseId || null,
          payerId: userId,
          payeeId: data.payeeId,
          paymentType,
          amount: Number(data.amount),
          currency: currency || 'ETB',
          commission: Number(data.commission) || calculatedCommission,
          subaccountId,
          splitPercentage,
          transactionReference: txRef,
          provider,
          status: PaymentStatus.PENDING,
          stripePaymentId: data.stripePaymentId || null,
          description: data.description || null,
          milestoneName: data.milestoneName || null,
          percentage: data.percentage ? Number(data.percentage) : null,
          stage: data.stage || null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: p.id,
          eventType: 'PAYMENT_CREATED',
          payload: {
            paymentId: p.id,
            payerId: userId,
            payeeId: data.payeeId,
            amount: p.amount,
            commission: p.commission,
            subaccountId,
            transactionReference: txRef,
            provider,
            currency: p.currency,
          },
        },
      });

      return p;
    });

    let checkoutResult: any = { checkoutUrl: null };
    if (provider === PaymentProvider.CHAPA || provider === PaymentProvider.TELEBIRR || provider === PaymentProvider.CBE_BIRR || provider === PaymentProvider.BOA) {
      checkoutResult = await this.chapaStrategy.initializePayment({
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        email: data.email,
        phone: data.phone,
        txRef,
        subaccountId: payeeWallet?.chapaSubaccountId || undefined,
        splitPercentage,
        commission: Number(payment.commission),
      });
    } else if (provider === PaymentProvider.STRIPE) {
      checkoutResult = await this.stripeStrategy.initializePayment({
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        email: data.email,
        phone: data.phone,
        txRef,
        stripeAccountId: payeeWallet?.stripeAccountId || undefined,
        subaccountId: payeeWallet?.stripeAccountId || undefined,
        splitPercentage,
        commission: Number(payment.commission),
      });
    }

    if (checkoutResult?.providerPaymentId) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { stripePaymentId: checkoutResult.providerPaymentId },
      });
    }

    return {
      ...payment,
      stripePaymentId: checkoutResult?.providerPaymentId || payment.stripePaymentId,
      checkoutUrl: checkoutResult.checkoutUrl || `https://checkout.tebeka.et/pay/${txRef}`,
    };
  }

  async requestPayment(data: any, attorneyId: string) {
    if (!data.caseId) throw new BadRequestException('caseId is required for payment request');
    if (!data.clientId) throw new BadRequestException('clientId is required');
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Valid positive amount is required');

    const paymentType = data.paymentType || PaymentType.CASE_MILESTONE;
    const txRef = `TX-REQ-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          caseId: data.caseId,
          payerId: data.clientId,
          payeeId: attorneyId,
          paymentType,
          amount: Number(data.amount),
          currency: data.currency || 'ETB',
          transactionReference: txRef,
          status: PaymentStatus.PENDING,
          requestedBy: attorneyId,
          requestedAt: new Date(),
          description: data.description || `Payment request for case ${data.caseId}`,
          milestoneName: data.milestoneName || null,
          percentage: data.percentage ? Number(data.percentage) : null,
          stage: data.stage || null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: payment.id,
          eventType: 'PAYMENT_REQUESTED',
          payload: {
            paymentId: payment.id,
            caseId: data.caseId,
            requestedBy: attorneyId,
            clientId: data.clientId,
            amount: payment.amount,
            transactionReference: txRef,
          },
        },
      });

      return payment;
    });
  }

  approvePayment(paymentId: string, clientId: string) {
    return this.markPaymentCompleted(paymentId, clientId);
  }

  markPaymentCompleted(paymentId: string, approvedBy?: string) {
    return this.completionService.markPaymentCompleted(paymentId, approvedBy);
  }

  markPaymentCompletedByReference(transactionReference: string, gatewayData?: any) {
    return this.completionService.markPaymentCompletedByReference(transactionReference, gatewayData);
  }

  markPaymentFailedByReference(transactionReference: string, reason?: string, gatewayData?: any) {
    return this.completionService.markPaymentFailedByReference(transactionReference, reason, gatewayData);
  }


  async getPayments(query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.payerId) where.payerId = query.payerId;
    if (query.payeeId) where.payeeId = query.payeeId;
    if (query.caseId) where.caseId = query.caseId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.currency) where.currency = query.currency.toUpperCase();
    if (query.paymentType) where.paymentType = query.paymentType;

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
      ];
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { refunds: true },
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'paidAt']: query.sortOrder || 'desc' },
      }),
      this.prisma.payment.count({ where }),
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
      data: payments,
    };
  }

  // =========================================================================
  // 3. ADMIN COMMISSION MANAGEMENT
  // =========================================================================

  getGlobalPlatformCommission() {
    return this.walletService.getGlobalPlatformCommission();
  }

  updateGlobalPlatformCommission(adminId: string, commissionPercentage: number) {
    return this.walletService.updateGlobalPlatformCommission(adminId, commissionPercentage);
  }

  updateAttorneyCommission(attorneyId: string, commissionPercentage: number, adminId?: string) {
    return this.walletService.updateAttorneyCommission(attorneyId, commissionPercentage, adminId);
  }

  // =========================================================================
  // 4. WALLET & PAYOUT SUBACCOUNT DELEGATIONS
  // =========================================================================

  setupAttorneyPayoutAccount(
    attorneyId: string,
    data: {
      businessName: string;
      accountName: string;
      bankCode: string | number;
      bankName?: string;
      accountNumber: string;
      splitPercentage?: number;
    },
  ) {
    return this.walletService.setupAttorneyPayoutAccount(attorneyId, data);
  }

  setupAttorneyStripeAccount(
    attorneyId: string,
    data: {
      email: string;
      businessName?: string;
      country?: string;
      returnUrl?: string;
      refreshUrl?: string;
    },
  ) {
    return this.walletService.setupAttorneyStripeAccount(attorneyId, data);
  }

  getBanks(query?: any) {
    return this.walletService.getBanks(query);
  }

  getAttorneyWallet(attorneyId: string) {
    return this.walletService.getAttorneyWallet(attorneyId);
  }

  // =========================================================================
  // 5. MANUAL REFUND DELEGATIONS
  // =========================================================================

  getRefunds(query?: { status?: any; payeeId?: string; payerId?: string }) {
    return this.refundService.getRefunds(query);
  }

  processManualRefund(refundId: string, processedBy: string, notes?: string) {
    return this.refundService.processManualRefund(refundId, processedBy, notes);
  }

  rejectManualRefund(refundId: string, rejectedBy: string, reason: string) {
    return this.refundService.rejectManualRefund(refundId, rejectedBy, reason);
  }
}
