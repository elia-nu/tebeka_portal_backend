import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, BookingStatus } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class MarketplaceSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketplaceSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.timer = setInterval(() => this.runScheduledJobs(), 60000); // Every 1 minute
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runScheduledJobs() {
    await this.expireAbandonedBookings();
  }

  private async expireAbandonedBookings() {
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
      const abandoned = await prisma.booking.findMany({
        where: {
          status: BookingStatus.PENDING,
          createdAt: { lt: fifteenMinsAgo },
        },
      });

      for (const booking of abandoned) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.CANCELLED },
          });

          await tx.bookingEvent.create({
            data: {
              bookingId: booking.id,
              event: 'BOOKING_EXPIRED',
              description: 'Booking automatically expired due to 15-minute unpaid inactivity (BR-BOOK-01).',
              createdBy: 'SYSTEM_SCHEDULER',
            },
          });

          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Booking',
              aggregateId: booking.id,
              eventType: 'BOOKING_EXPIRED',
              payload: { bookingId: booking.id, clientId: booking.clientId, attorneyId: booking.attorneyId },
            },
          });
        });

        this.logger.log(`Abandoned booking ${booking.id} expired.`);
      }
    } catch (err: any) {
      if (err?.code === 'P2022' || err?.code === 'P2021' || err?.message?.includes('does not exist')) {
        this.logger.debug('Bookings table schema mismatch in database. Skipping expiration check until db push.');
      } else {
        this.logger.error('Error expiring abandoned bookings:', err);
      }
    }
  }
}
