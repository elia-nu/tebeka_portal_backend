import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '@workspace/event-bus';
import { GoogleMeetService } from '../integrations/google-meet.service';
import { DiscoveryService } from '../discovery/discovery.service';

@Injectable()
export class MarketplaceEventsConsumer implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceEventsConsumer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly googleMeetService: GoogleMeetService,
    @Optional() private readonly discoveryService?: DiscoveryService
  ) {}

  onModuleInit() {
    this.subscribeToUserEvents();
  }

  private subscribeToUserEvents() {
    this.eventBus.subscribe('ATTORNEY_VERIFIED', async (data: any) => {
      this.logger.log(`Handling ATTORNEY_VERIFIED event for attorney: ${data.attorneyId || data.aggregateId}`);
      const attorneyId = data.attorneyId || data.aggregateId;
      if (!attorneyId) return;

      await this.prisma.discoveryIndex.upsert({
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

      if (data.verificationStatus && data.verificationStatus !== 'APPROVED') {
        await this.prisma.discoveryIndex.deleteMany({ where: { attorneyId } });
        this.discoveryService?.clearDiscoveryCache(attorneyId);
        return;
      }

      const existing = await this.prisma.discoveryIndex.findUnique({ where: { attorneyId } });
      if (existing) {
        await this.prisma.discoveryIndex.update({
          where: { attorneyId },
          data: {
            ...(data.city && { city: data.city }),
            ...(data.feeBand && { feeBand: data.feeBand }),
            ...(data.languages && { languages: data.languages }),
            ...(data.practiceAreaIds && { practiceAreaIds: data.practiceAreaIds }),
          },
        });
      } else if (data.verifiedAt || data.verificationStatus === 'APPROVED') {
        await this.prisma.discoveryIndex.create({
          data: {
            attorneyId,
            verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : new Date(),
            city: data.city || 'Addis Ababa',
            feeBand: data.feeBand || 'TIER_1',
            languages: data.languages || ['en', 'am'],
            practiceAreaIds: data.practiceAreaIds || [],
          },
        });
      }
    });

    this.eventBus.subscribe('ATTORNEY_SUSPENDED', async (data: any) => {
      const attorneyId = data.attorneyId || data.aggregateId;
      this.logger.log(`Handling ATTORNEY_SUSPENDED event: removing attorney ${attorneyId} from DiscoveryIndex`);
      if (!attorneyId) return;

      await this.prisma.discoveryIndex.deleteMany({
        where: { attorneyId },
      });
      this.discoveryService?.clearDiscoveryCache(attorneyId);
    });

    this.eventBus.subscribe('ATTORNEY_UNVERIFIED', async (data: any) => {
      const attorneyId = data.attorneyId || data.aggregateId;
      this.logger.log(`Handling ATTORNEY_UNVERIFIED event: removing attorney ${attorneyId} from DiscoveryIndex`);
      if (!attorneyId) return;

      await this.prisma.discoveryIndex.deleteMany({
        where: { attorneyId },
      });
      this.discoveryService?.clearDiscoveryCache(attorneyId);
    });

    this.eventBus.subscribe('USER_SUSPENDED', async (data: any) => {
      const attorneyId = data.attorneyId || data.userId || data.aggregateId;
      this.logger.log(`Handling USER_SUSPENDED event: removing attorney ${attorneyId} from DiscoveryIndex`);
      if (!attorneyId) return;

      await this.prisma.discoveryIndex.deleteMany({
        where: { attorneyId },
      });
      this.discoveryService?.clearDiscoveryCache(attorneyId);
    });

    // Cross-Service Saga: Ingest PAYMENT_COMPLETED event from financial-service
    this.eventBus.subscribeIdempotent(
      'PAYMENT_COMPLETED',
      'marketplace-service',
      this.prisma,
      async (data: any) => {
        this.logger.log(
          `Handling PAYMENT_COMPLETED event for payment: ${data.paymentId || data.aggregateId}, booking: ${data.bookingId}, case: ${data.caseId}`
        );

        // 1. Process Consultation Booking Payment
        const bookingId = data.bookingId;
        if (bookingId) {
          const existingBooking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
          if (!existingBooking) {
            this.logger.warn(`Booking ${bookingId} not found for PAYMENT_COMPLETED event`);
          } else if (existingBooking.status === 'CONFIRMED') {
            this.logger.log(`Booking ${bookingId} already confirmed.`);
          } else {
            // Generate real Google Meet video room & Google Calendar invite
            let meetResult;
            try {
              meetResult = await this.googleMeetService.createConsultationMeeting({
                bookingId: existingBooking.id,
                referenceNumber: existingBooking.referenceNumber || existingBooking.id,
                bookingDate: existingBooking.bookingDate,
                startTime: existingBooking.startTime,
                endTime: existingBooking.endTime,
                clientEmail: data.payerEmail || `client-${existingBooking.clientId}@tebeka.et`,
                attorneyEmail: data.payeeEmail || `attorney-${existingBooking.attorneyId}@tebeka.et`,
              });
            } catch (err: any) {
              this.logger.warn(`Google Meet provision error: ${err?.message || err}. Falling back to deterministic link.`);
              const fallbackLink = this.googleMeetService.generateMeetLink(existingBooking.referenceNumber || existingBooking.id);
              meetResult = {
                meetingLink: fallbackLink,
                googleCalendarEventId: null,
                calendarHtmlLink: undefined,
                isMock: true,
              };
            }

            await this.prisma.$transaction(async (tx) => {
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
        }

        // 2. Process Legal Case Milestone Payment
        const caseId = data.caseId;
        if (caseId) {
          const caseItem = await this.prisma.case.findUnique({
            where: { id: caseId },
            include: { caseMilestones: true },
          });

          if (!caseItem) {
            this.logger.warn(`Case ${caseId} not found for PAYMENT_COMPLETED event`);
          } else {
            await this.prisma.$transaction(async (tx) => {
              // Activate case if OPEN
              if (caseItem.status === 'OPEN') {
                await tx.case.update({
                  where: { id: caseId },
                  data: { status: 'IN_PROGRESS' },
                });
              }

              // Update matching milestone (or first pending milestone) to IN_PROGRESS
              let activatedMilestoneTitle = data.milestoneName || null;
              if (data.milestoneName) {
                const milestone = caseItem.caseMilestones.find(
                  (m) => m.title.toLowerCase() === data.milestoneName.toLowerCase() && m.status === 'PENDING'
                );
                if (milestone) {
                  await tx.caseMilestone.update({
                    where: { id: milestone.id },
                    data: { status: 'IN_PROGRESS' },
                  });
                  activatedMilestoneTitle = milestone.title;
                }
              } else {
                const pendingMilestone = caseItem.caseMilestones.find((m) => m.status === 'PENDING');
                if (pendingMilestone) {
                  await tx.caseMilestone.update({
                    where: { id: pendingMilestone.id },
                    data: { status: 'IN_PROGRESS' },
                  });
                  activatedMilestoneTitle = pendingMilestone.title;
                }
              }

              // Create timeline entry for milestone escrow payment
              await tx.caseTimeline.create({
                data: {
                  caseId,
                  title: 'Milestone Escrow Payment Secured',
                  description: `Payment of ${data.amount} ${data.currency || 'ETB'} completed and held in escrow. Milestone ${activatedMilestoneTitle ? `"${activatedMilestoneTitle}"` : ''} activated.`,
                  eventDate: new Date(),
                },
              });

              await tx.outboxEvent.create({
                data: {
                  aggregateType: 'Case',
                  aggregateId: caseId,
                  eventType: 'CASE_MILESTONE_PAID',
                  payload: {
                    caseId,
                    paymentId: data.paymentId || data.aggregateId,
                    amount: data.amount,
                    currency: data.currency || 'ETB',
                    milestoneName: activatedMilestoneTitle,
                    payerId: data.payerId,
                    payeeId: data.payeeId,
                  },
                },
              });

              this.logger.log(
                `Case [${caseId}] milestone payment of ${data.amount} ${data.currency || 'ETB'} processed and activated successfully.`
              );
            });
          }
        }

      }
    );
  }
}
