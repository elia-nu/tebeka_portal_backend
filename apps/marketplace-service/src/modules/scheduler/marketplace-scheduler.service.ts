import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, BookingStatus } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class MarketplaceSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketplaceSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.timer = setInterval(() => this.runScheduledJobs(), 60000); // Runs every 1 minute
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runScheduledJobs() {
    await this.expireUnansweredRequests();
    await this.expireUnpaidAcceptedBookings();
    await this.expirePendingRescheduleProposals();
  }

  /**
   * 1. Auto-expire REQUESTED bookings where attorney did not respond within 24 hours
   */
  private async expireUnansweredRequests() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredRequests = await prisma.booking.findMany({
        where: {
          status: BookingStatus.REQUESTED,
          createdAt: { lt: twentyFourHoursAgo },
        },
      });

      for (const booking of expiredRequests) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.EXPIRED },
          });

          await tx.bookingEvent.create({
            data: {
              bookingId: booking.id,
              event: 'BOOKING_EXPIRED',
              description: 'Booking expired due to no attorney response within 24 hours (BR-BOOK-01).',
              createdBy: 'SYSTEM_SCHEDULER',
            },
          });

          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Booking',
              aggregateId: booking.id,
              eventType: 'BOOKING_EXPIRED',
              payload: {
                bookingId: booking.id,
                referenceNumber: booking.referenceNumber,
                clientId: booking.clientId,
                attorneyId: booking.attorneyId,
                reason: 'No attorney response within 24 hours',
              },
            },
          });
        });

        this.logger.log(`Unanswered consultation request [${booking.id}] auto-expired.`);
      }
    } catch (err: any) {
      this.logger.error('Error expiring unanswered requests:', err);
    }
  }

  /**
   * 2. Auto-expire ACCEPTED_PENDING_PAYMENT bookings where client did not pay within 24 hours
   */
  private async expireUnpaidAcceptedBookings() {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const unpaidBookings = await prisma.booking.findMany({
        where: {
          status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
          createdAt: { lt: twentyFourHoursAgo },
        },
      });

      for (const booking of unpaidBookings) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.EXPIRED },
          });

          await tx.bookingEvent.create({
            data: {
              bookingId: booking.id,
              event: 'BOOKING_EXPIRED',
              description: 'Booking expired due to unpaid checkout within 24 hours.',
              createdBy: 'SYSTEM_SCHEDULER',
            },
          });

          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Booking',
              aggregateId: booking.id,
              eventType: 'BOOKING_EXPIRED',
              payload: {
                bookingId: booking.id,
                referenceNumber: booking.referenceNumber,
                clientId: booking.clientId,
                attorneyId: booking.attorneyId,
                reason: 'Unpaid within 24 hours',
              },
            },
          });
        });

        this.logger.log(`Unpaid accepted booking [${booking.id}] auto-expired.`);
      }
    } catch (err: any) {
      this.logger.error('Error expiring unpaid accepted bookings:', err);
    }
  }

  /**
   * 3. Clear expired reschedule proposals (12 hours elapsed)
   */
  private async expirePendingRescheduleProposals() {
    try {
      const now = new Date();
      const expiredProposals = await prisma.booking.findMany({
        where: {
          rescheduleExpiresAt: { lte: now },
          proposedBookingDate: { not: null },
        },
      });

      for (const booking of expiredProposals) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              rescheduleProposedBy: null,
              proposedBookingDate: null,
              proposedStartTime: null,
              proposedEndTime: null,
              rescheduleExpiresAt: null,
            },
          });

          await tx.bookingEvent.create({
            data: {
              bookingId: booking.id,
              event: 'RESCHEDULE_EXPIRED',
              description: 'Reschedule proposal expired after 12 hours. Original time slot maintained.',
              createdBy: 'SYSTEM_SCHEDULER',
            },
          });
        });

        this.logger.log(`Reschedule proposal on booking [${booking.id}] cleared after 12h expiry.`);
      }
    } catch (err: any) {
      this.logger.error('Error expiring pending reschedule proposals:', err);
    }
  }
}
