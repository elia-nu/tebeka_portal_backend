import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient, PaymentStatus, PaymentType, PaymentProvider, LedgerEntryType } from '@prisma/client/financial';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

const prisma = new PrismaClient();

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly chapaStrategy: ChapaStrategy,
    private readonly stripeStrategy: StripeStrategy,
  ) {}

  async createPayment(data: any, userId: string) {
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Valid positive amount is required');
    if (!data.payeeId) throw new BadRequestException('payeeId is required');

    const paymentType = data.paymentType || (data.caseId ? PaymentType.CASE_MILESTONE : PaymentType.CONSULTATION_ONE_TIME);
    const provider = (data.provider as PaymentProvider) || PaymentProvider.CHAPA;
    const txRef = `TX-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Lookup payee subaccount for Chapa Split Payment
    const payeeWallet = await prisma.wallet.findUnique({ where: { userId: data.payeeId } });
    const subaccountId = payeeWallet?.chapaSubaccountId || null;
    const splitPercentage = payeeWallet?.splitPercentage || 15.0; // 15% platform fee
    const calculatedCommission = (Number(data.amount) * splitPercentage) / 100;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          bookingId: data.bookingId || null,
          caseId: data.caseId || null,
          payerId: userId,
          payeeId: data.payeeId,
          paymentType,
          amount: Number(data.amount),
          currency: data.currency || 'ETB',
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
          },
        },
      });

      return p;
    });

    let checkoutResult: any = { checkoutUrl: null };
    if (provider === PaymentProvider.CHAPA || provider === PaymentProvider.TELEBIRR || provider === PaymentProvider.CBE_BIRR) {
      checkoutResult = await this.chapaStrategy.initializePayment({
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        email: data.email,
        phone: data.phone,
        txRef,
        subaccountId: subaccountId || undefined,
      });
    } else if (provider === PaymentProvider.STRIPE) {
      checkoutResult = await this.stripeStrategy.initializePayment({
        paymentId: payment.id,
        amount: Number(payment.amount),
        currency: payment.currency,
        email: data.email,
        txRef,
      });
    }

    return {
      ...payment,
      checkoutUrl: checkoutResult.checkoutUrl || `https://checkout.tebeka.et/pay/${txRef}`,
    };
  }

  async requestPayment(data: any, attorneyId: string) {
    if (!data.caseId) throw new BadRequestException('caseId is required for payment request');
    if (!data.clientId) throw new BadRequestException('clientId is required');
    if (!data.amount || data.amount <= 0) throw new BadRequestException('Valid positive amount is required');

    const paymentType = data.paymentType || PaymentType.CASE_MILESTONE;
    const txRef = `TX-REQ-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return prisma.$transaction(async (tx) => {
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
          payload: { paymentId: payment.id, caseId: data.caseId, requestedBy: attorneyId, clientId: data.clientId, amount: payment.amount, transactionReference: txRef },
        },
      });

      return payment;
    });
  }

  async approvePayment(paymentId: string, clientId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);
    if (payment.payerId !== clientId) throw new BadRequestException('Only the designated payer can approve this payment request');

    return this.markPaymentCompleted(payment.id, clientId);
  }

  async markPaymentCompleted(paymentId: string, approvedBy?: string) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

      if (payment.status === PaymentStatus.COMPLETED) {
        return payment; // Idempotent no-op
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.COMPLETED,
          approvedBy: approvedBy || payment.payerId,
          approvedAt: new Date(),
          paidAt: new Date(),
        },
      });

      // Atomic Ledger Entry creation
      const netAmount = updated.amount.minus(updated.commission);
      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: LedgerEntryType.CREDIT,
          amount: updated.amount,
          balanceAfter: netAmount,
        },
      });

      if (updated.commission.greaterThan(0)) {
        await tx.ledgerEntry.create({
          data: {
            paymentId: updated.id,
            entryType: LedgerEntryType.COMMISSION,
            amount: updated.commission,
            balanceAfter: updated.commission,
          },
        });
      }

      // Upsert Payee Wallet pending escrow balance
      if (updated.payeeId) {
        await tx.wallet.upsert({
          where: { userId: updated.payeeId },
          update: {
            pendingBalance: { increment: netAmount },
          },
          create: {
            userId: updated.payeeId,
            availableBalance: 0,
            pendingBalance: netAmount,
            currency: updated.currency,
          },
        });
      }

      // Write PAYMENT_COMPLETED event to Outbox table
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: updated.id,
          eventType: 'PAYMENT_COMPLETED',
          payload: {
            paymentId: updated.id,
            bookingId: updated.bookingId || null,
            caseId: updated.caseId || null,
            payerId: updated.payerId,
            payeeId: updated.payeeId,
            amount: Number(updated.amount),
            currency: updated.currency,
            status: 'COMPLETED',
            approvedBy: approvedBy || payment.payerId,
          },
        },
      });

      return updated;
    });
  }

  async markPaymentCompletedByReference(transactionReference: string, gatewayData?: any) {
    const payment = await prisma.payment.findFirst({
      where: { transactionReference },
    });
    if (!payment) {
      this.logger.warn(`No payment found for transaction reference ${transactionReference}`);
      return null;
    }
    return this.markPaymentCompleted(payment.id);
  }

  async getPayments(query: any = {}) {
    const where: any = {};
    if (query.payerId) where.payerId = query.payerId;
    if (query.payeeId) where.payeeId = query.payeeId;
    if (query.caseId) where.caseId = query.caseId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.status) where.status = query.status;

    return prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
    });
  }

  async setupAttorneyPayoutAccount(
    attorneyId: string,
    data: {
      businessName: string;
      accountName: string;
      bankCode: string | number;
      bankName?: string;
      accountNumber: string;
      splitPercentage?: number; // e.g., 15 for 15% platform commission
    }
  ) {
    const splitPercentage = data.splitPercentage || 15.0;
    const splitValue = splitPercentage / 100; // e.g., 0.15 for Chapa API

    // Register Subaccount with Chapa Payment Gateway
    const subaccountRes = await this.chapaStrategy.createSubaccount({
      businessName: data.businessName,
      accountName: data.accountName,
      bankCode: data.bankCode,
      accountNumber: data.accountNumber,
      splitValue,
      splitType: 'percentage',
    });

    const chapaSubaccountId = subaccountRes.subaccountId || `sub_${attorneyId}_${Date.now()}`;

    // Upsert attorney wallet with subaccount link
    const wallet = await prisma.wallet.upsert({
      where: { userId: attorneyId },
      update: {
        chapaSubaccountId,
        bankCode: String(data.bankCode),
        bankName: data.bankName || null,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        splitPercentage,
      },
      create: {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'ETB',
        chapaSubaccountId,
        bankCode: String(data.bankCode),
        bankName: data.bankName || null,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        splitPercentage,
      },
    });

    this.logger.log(`Attorney [${attorneyId}] payout subaccount registered: ${chapaSubaccountId}`);

    return {
      success: true,
      message: 'Payout subaccount registered successfully with Chapa Split Payment',
      wallet,
      chapaSubaccountId,
    };
  }

  async getBanks() {
    return this.chapaStrategy.getBanks();
  }

  async getAttorneyWallet(attorneyId: string) {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: attorneyId },
    });

    // Also fetch any pending refunds or dispute records associated with attorney's payments
    const pendingRefunds = await prisma.refund.findMany({
      where: {
        payment: { payeeId: attorneyId },
        status: 'PENDING',
      },
      include: {
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!wallet) {
      return {
        userId: attorneyId,
        availableBalance: 0,
        pendingBalance: 0,
        currency: 'ETB',
        chapaSubaccountId: null,
        pendingRefunds,
      };
    }

    return {
      ...wallet,
      pendingRefunds,
    };
  }

  async getRefunds(query?: { status?: any; payeeId?: string; payerId?: string }) {
    return prisma.refund.findMany({
      where: {
        ...(query?.status && { status: query.status }),
        ...(query?.payeeId && { payment: { payeeId: query.payeeId } }),
        ...(query?.payerId && { payment: { payerId: query.payerId } }),
      },
      include: {
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async processManualRefund(refundId: string, processedBy: string, notes?: string) {
    return prisma.$transaction(async (tx) => {
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
      const attorneyPendingDeduction = (refundAmount * (100 - (refund.payment.splitPercentage || 15))) / 100;
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
    const refund = await prisma.refund.findUnique({ where: { id: refundId } });
    if (!refund) throw new NotFoundException(`Refund ${refundId} not found`);

    return prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        reason: `${refund.reason || ''} | Rejected by ${rejectedBy}: ${reason}`,
      },
    });
  }
}

