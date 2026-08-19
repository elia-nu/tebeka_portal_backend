import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/marketplace';
import { EventBusService } from '@workspace/event-bus';
import { GoogleMeetService } from '../integrations/google-meet.service';

const prisma = new PrismaClient();

@Injectable()
export class MarketplaceEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceEventsConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly googleMeetService: GoogleMeetService
  ) {}

  onModuleInit() {
    this.subscribeToUserEvents();
  }

  private subscribeToUserEvents() {
    this.eventBus.subscribe('ATTORNEY_VERIFIED', async (data: any) => {
      this.logger.log(`Handling ATTORNEY_VERIFIED event for attorney: ${data.attorneyId || data.aggregateId}`);
      const attorneyId = data.attorneyId || data.aggregateId;
      if (!attorneyId) return;

      await prisma.discoveryIndex.upsert({
        where: { attorneyId },
        update: {
          verifiedAt: new Date(),
        },
        create: {
          attorneyId,
          verifiedAt: new Date(),
          practiceAreaIds: data.practiceAreaIds || [],
          city: data.city || 'Addis Ababa',
          languages: data.languages || ['en', 'am'],
        },
      });
    });

    this.eventBus.subscribe('ATTORNEY_PROFILE_UPDATED', async (data: any) => {
      this.logger.log(`Handling ATTORNEY_PROFILE_UPDATED event for attorney: ${data.attorneyId || data.aggregateId}`);
      const attorneyId = data.attorneyId || data.aggregateId;
      if (!attorneyId) return;

      await prisma.discoveryIndex.upsert({
        where: { attorneyId },
        update: {
          ...(data.city && { city: data.city }),
          ...(data.feeBand && { feeBand: data.feeBand }),
          ...(data.languages && { languages: data.languages }),
          ...(data.practiceAreaIds && { practiceAreaIds: data.practiceAreaIds }),
        },
        create: {
          attorneyId,
          city: data.city || 'Addis Ababa',
          feeBand: data.feeBand || 'TIER_1',
          languages: data.languages || ['en', 'am'],
          practiceAreaIds: data.practiceAreaIds || [],
        },
      });
    });

    // Cross-Service Saga: Ingest PAYMENT_COMPLETED event from financial-service
    this.eventBus.subscribeIdempotent(
      'PAYMENT_COMPLETED',
      'marketplace-service',
      prisma,
      async (data: any) => {
        this.logger.log(
          `Handling PAYMENT_COMPLETED event for payment: ${data.paymentId || data.aggregateId}, booking: ${data.bookingId}`
        );
        const bookingId = data.bookingId;
        if (!bookingId) return;

        // Fetch existing booking
        const existingBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!existingBooking) {
          this.logger.warn(`Booking ${bookingId} not found for PAYMENT_COMPLETED event`);
          return;
        }

        if (existingBooking.status === 'CONFIRMED') {
          this.logger.log(`Booking ${bookingId} already confirmed.`);
          return;
        }

        // Generate real Google Meet video room & Google Calendar invite
        const meetResult = await this.googleMeetService.createConsultationMeeting({
          bookingId: existingBooking.id,
          referenceNumber: existingBooking.referenceNumber || existingBooking.id,
          bookingDate: existingBooking.bookingDate,
          startTime: existingBooking.startTime,
          endTime: existingBooking.endTime,
          clientEmail: data.payerEmail || `client-${existingBooking.clientId}@tebeka.et`,
          attorneyEmail: data.payeeEmail || `attorney-${existingBooking.attorneyId}@tebeka.et`,
        });

        await prisma.$transaction(async (tx) => {
          const updated = await tx.booking.update({
            where: { id: bookingId },
            data: {
              status: 'CONFIRMED',
              paymentStatus: 'PAID',
              meetingLink: meetResult.meetingLink,
              googleCalendarEventId: meetResult.googleCalendarEventId,
            },
          });

          await tx.bookingEvent.create({
            data: {
              bookingId,
              event: 'BOOKING_CONFIRMED',
              description: `Payment of ${data.amount} ${data.currency || 'ETB'} completed. Google Meet room created: ${meetResult.meetingLink}`,
              createdBy: data.payerId || 'system',
            },
          });

          await tx.bookingTimeline.create({
            data: {
              bookingId,
              title: 'Consultation Confirmed & Google Meet Ready',
              description: `Meeting Room: ${meetResult.meetingLink}`,
              eventDate: new Date(),
            },
          });

          await tx.outboxEvent.create({
            data: {
              aggregateType: 'Booking',
              aggregateId: bookingId,
              eventType: 'BOOKING_CONFIRMED',
              payload: {
                bookingId,
                referenceNumber: updated.referenceNumber,
                clientId: updated.clientId,
                attorneyId: updated.attorneyId,
                bookingDate: updated.bookingDate,
                startTime: updated.startTime,
                endTime: updated.endTime,
                meetingLink: updated.meetingLink,
                googleCalendarEventId: updated.googleCalendarEventId,
                calendarHtmlLink: meetResult.calendarHtmlLink,
              },
            },
          });

          this.logger.log(
            `Booking [${bookingId}] successfully CONFIRMED with Google Meet room: ${meetResult.meetingLink}`
          );
        });
      }
    );
  }
}
