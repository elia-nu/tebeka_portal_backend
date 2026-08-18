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
          commission: Number(data.commission) || 0.0,
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
          payload: { paymentId: p.id, payerId: userId, payeeId: data.payeeId, amount: p.amount, transactionReference: txRef },
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
      await tx.ledgerEntry.create({
        data: {
          paymentId: updated.id,
          entryType: LedgerEntryType.CREDIT,
          amount: updated.amount,
          balanceAfter: updated.amount.minus(updated.commission),
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

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Payment',
          aggregateId: updated.id,
          eventType: 'PAYMENT_APPROVED',
          payload: { paymentId: updated.id, caseId: updated.caseId, approvedBy: approvedBy || payment.payerId, amount: updated.amount },
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
}

