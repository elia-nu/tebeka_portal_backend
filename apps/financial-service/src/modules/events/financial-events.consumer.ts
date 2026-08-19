import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient, RefundStatus, PaymentStatus } from '@prisma/client/financial';
import { EventBusService } from '@workspace/event-bus';

const prisma = new PrismaClient();

@Injectable()
export class FinancialEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(FinancialEventsConsumer.name);

  constructor(private readonly eventBus: EventBusService) {}

  onModuleInit() {
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // Cross-Service Saga: Ingest BOOKING_CANCELLED and create PENDING refund record for manual admin review
    this.eventBus.subscribeIdempotent(
      'BOOKING_CANCELLED',
      'financial-service',
      prisma,
      async (data: any) => {
        this.logger.log(
          `Handling BOOKING_CANCELLED event for booking: ${data.bookingId}, refund: ${data.refundPercentage}%`
        );
        const bookingId = data.bookingId;
        if (!bookingId) return;

        const payment = await prisma.payment.findFirst({
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

        await prisma.$transaction(async (tx) => {
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
      prisma,
      async (data: any) => {
        this.logger.log(
          `Handling BOOKING_NOSHOW event for booking: ${data.bookingId}, fault: ${data.faultParty}`
        );
        const bookingId = data.bookingId;
        if (!bookingId) return;

        const payment = await prisma.payment.findFirst({
          where: { bookingId, status: PaymentStatus.COMPLETED },
        });

        if (!payment) return;

        if (data.faultParty === 'ATTORNEY') {
          const refundAmount = Number(payment.amount);
          await prisma.$transaction(async (tx) => {
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
  }
}
