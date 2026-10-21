import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RefundStatus, PaymentStatus } from '@prisma/client/financial';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '@workspace/event-bus';
import { EscrowReleaseService } from '../payments/services/escrow-release.service';

@Injectable()
export class FinancialEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(FinancialEventsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly escrowReleaseService: EscrowReleaseService,
  ) {}

  onModuleInit() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // Cross-Service Saga: Ingest BOOKING_CANCELLED and create PENDING refund record for manual admin review
    this.eventBus.subscribeIdempotent(
      'BOOKING_CANCELLED',
      'financial-service',
      this.prisma,
      async (data: any) => {
        this.logger.log(
          `Handling BOOKING_CANCELLED event for booking: ${data.bookingId}, refund: ${data.refundPercentage}%`
        );
        const bookingId = data.bookingId;
        if (!bookingId) return;

        const payment = await this.prisma.payment.findFirst({
          where: { bookingId, status: PaymentStatus.COMPLETED },
        });

        if (!payment) {
          this.logger.log(`No completed payment found for booking ${bookingId}. No refund record required.`);
          return;
        }

        const refundPercentage = Number(data.refundPercentage || 0);
        if (refundPercentage <= 0) {
          this.logger.log(`Cancellation refund policy is 0% for booking ${bookingId}. No refund record created.`);
          return;
        }

        const originalAmount = Number(payment.amount);
        const refundAmount = (originalAmount * refundPercentage) / 100;

        await this.prisma.$transaction(async (tx) => {
          // 1. Create PENDING Refund Record for Manual Admin/Attorney Review
          const refund = await tx.refund.create({
            data: {
              paymentId: payment.id,
              amount: refundAmount,
              reason: `Booking Cancelled by ${data.isAttorneyCancelling ? 'Attorney' : 'Client'} (${refundPercentage}% policy - ${data.refundPolicyTier || 'MANUAL'}). Reason: ${data.reason || 'N/A'}`,
              status: RefundStatus.PENDING,
            },
          });

          // 2. Emit Outbox Event for Admin & Attorney Portal notifications
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Refund',
              aggregateId: refund.id,
              eventType: 'REFUND_REQUESTED',
              payload: {
                refundId: refund.id,
                paymentId: payment.id,
                bookingId,
                payerId: payment.payerId,
                payeeId: payment.payeeId,
                amount: refundAmount,
                refundPercentage,
                status: 'PENDING',
              },
            },
          });

          this.logger.log(
            `Manual Refund Record [${refund.id}] created in PENDING status for ${refundAmount} ETB on booking [${bookingId}]. Awaiting admin/attorney processing.`
          );
        });
      }
    );

    // Cross-Service Saga: Ingest BOOKING_NOSHOW and create PENDING refund record if fault is attorney
    this.eventBus.subscribeIdempotent(
      'BOOKING_NOSHOW',
      'financial-service',
      this.prisma,
      async (data: any) => {
        this.logger.log(
          `Handling BOOKING_NOSHOW event for booking: ${data.bookingId}, fault: ${data.faultParty}`
        );
        const bookingId = data.bookingId;
        if (!bookingId) return;

        const payment = await this.prisma.payment.findFirst({
          where: { bookingId, status: PaymentStatus.COMPLETED },
        });

        if (!payment) return;

        if (data.faultParty === 'ATTORNEY') {
          const refundAmount = Number(payment.amount);
          await this.prisma.$transaction(async (tx) => {
            const refund = await tx.refund.create({
              data: {
                paymentId: payment.id,
                amount: refundAmount,
                reason: `Attorney No-Show dispute reported by client. Reason: ${data.reason || 'N/A'}`,
                status: RefundStatus.PENDING,
              },
            });

            await tx.outboxEvent.create({
              data: {
                aggregateType: 'Refund',
                aggregateId: refund.id,
                eventType: 'REFUND_REQUESTED',
                payload: {
                  refundId: refund.id,
                  paymentId: payment.id,
                  bookingId,
                  payerId: payment.payerId,
                  payeeId: payment.payeeId,
                  amount: refundAmount,
                  status: 'PENDING',
                },
              },
            });

            this.logger.log(`Manual Refund Record [${refund.id}] created in PENDING status for Attorney No-Show on booking ${bookingId}`);
          });
        }
      }
    );

    // Cross-Service Saga: Ingest BOOKING_COMPLETED and release pending escrow to attorney available balance
    this.eventBus.subscribeIdempotent(
      'BOOKING_COMPLETED',
      'financial-service',
      this.prisma,
      async (data: any) => {
        const bookingId = data.bookingId || data.aggregateId;
        this.logger.log(`Handling BOOKING_COMPLETED event for booking [${bookingId}] to release escrow`);
        if (!bookingId) return;

        try {
          await this.escrowReleaseService.releaseEscrowForBooking(
            bookingId,
            data.completedBy || data.approvedBy || 'BOOKING_COMPLETED_EVENT'
          );
        } catch (err: any) {
          this.logger.error(`Error releasing escrow for booking [${bookingId}]:`, err?.message || err);
        }
      }
    );

    // Cross-Service Saga: Ingest MILESTONE_ACKNOWLEDGED and release pending escrow to attorney available balance
    this.eventBus.subscribeIdempotent(
      'MILESTONE_ACKNOWLEDGED',
      'financial-service',
      this.prisma,
      async (data: any) => {
        const caseId = data.caseId || data.aggregateId;
        const milestoneName = data.title || data.milestoneName;
        this.logger.log(
          `Handling MILESTONE_ACKNOWLEDGED event for case [${caseId}], milestone: [${milestoneName || 'ALL'}]`
        );
        if (!caseId) return;

        try {
          await this.escrowReleaseService.releaseEscrowForMilestone(
            caseId,
            milestoneName,
            data.clientId || 'MILESTONE_ACKNOWLEDGED_EVENT'
          );
        } catch (err: any) {
          this.logger.error(`Error releasing milestone escrow for case [${caseId}]:`, err?.message || err);
        }
      }
    );

    // Cross-Service Saga: Ingest CASE_MILESTONE_COMPLETED fallback
    this.eventBus.subscribeIdempotent(
      'CASE_MILESTONE_COMPLETED',
      'financial-service',
      this.prisma,
      async (data: any) => {
        const caseId = data.caseId || data.aggregateId;
        const milestoneName = data.title || data.milestoneName;
        this.logger.log(`Handling CASE_MILESTONE_COMPLETED event for case [${caseId}]`);
        if (!caseId) return;

        try {
          await this.escrowReleaseService.releaseEscrowForMilestone(
            caseId,
            milestoneName,
            data.approvedBy || 'CASE_MILESTONE_COMPLETED_EVENT'
          );
        } catch (err: any) {
          this.logger.error(`Error releasing milestone escrow for case [${caseId}]:`, err?.message || err);
        }
      }
    );
  }
}
