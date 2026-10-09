import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { BookingStatus, ConsultationType } from '@prisma/client/marketplace';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';
import { GoogleMeetService } from '../integrations/google-meet.service';
import { UserServiceClient } from '../../integrations/user-service.client';
import { BookingCancellationService } from './services/booking-cancellation.service';
import { BookingRescheduleService } from './services/booking-reschedule.service';
import { BookingDisputeService } from './services/booking-dispute.service';
import { BookingAvailabilityService } from './services/booking-availability.service';
import { BookingCreationService } from './services/booking-creation.service';
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  generateTimeIntervals,
} from './utils/booking-time.util';

@Injectable()
export class BookingService {
  private readonly creationService: BookingCreationService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cancellationService: BookingCancellationService,
    private readonly rescheduleService: BookingRescheduleService,
    private readonly disputeService: BookingDisputeService,
    @Optional() private readonly availabilityService?: BookingAvailabilityService,
    @Optional() private readonly communicationServiceClient?: CommunicationServiceClient,
    @Optional() private readonly googleMeetService?: GoogleMeetService,
    @Optional() private readonly userServiceClient?: UserServiceClient,
    @Optional() bookingCreationService?: BookingCreationService
  ) {
    this.creationService =
      bookingCreationService ||
      new BookingCreationService(this.prisma, this.googleMeetService, this.userServiceClient);
  }

  // =========================================================================
  // 1. CORE BOOKING CREATION & LIFECYCLE
  // =========================================================================

  createBooking(data: any, clientId: string, correlationId?: string) {
    return this.creationService.createBooking(data, clientId, correlationId);
  }

  enrichBookingWithFee(booking: any, correlationId?: string) {
    return this.creationService.enrichBookingWithFee(booking, correlationId);
  }


  async acceptBooking(id: string, attorneyId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.attorneyId !== attorneyId) {
        throw new ForbiddenException('You can only accept bookings requested for you');
      }

      if (booking.status !== BookingStatus.REQUESTED) {
        throw new BadRequestException(`Cannot accept booking in ${booking.status} status`);
      }

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.ACCEPTED_PENDING_PAYMENT },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_ACCEPTED',
          description: `Booking request accepted by attorney ${attorneyId}. Pending client payment.`,
          createdBy: attorneyId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_ACCEPTED',
          payload: {
            bookingId: id,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
          },
        },
      });

      return updatedBooking;
    });

    return this.enrichBookingWithFee(updated);
  }

  async declineBooking(id: string, attorneyId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.attorneyId !== attorneyId) {
        throw new ForbiddenException('You can only decline bookings requested for you');
      }

      if (booking.status !== BookingStatus.REQUESTED) {
        throw new BadRequestException(`Cannot decline booking in ${booking.status} status`);
      }

      const updated = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.DECLINED },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_DECLINED',
          description: reason || `Booking request declined by attorney ${attorneyId}`,
          createdBy: attorneyId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_DECLINED',
          payload: {
            bookingId: id,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            reason,
            status: BookingStatus.DECLINED,
          },
        },
      });

      return updated;
    });
  }

  async findUserBookings(userId: string, role: string, query: any, correlationId?: string) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role === 'CLIENT') {
      where.clientId = userId;
    } else if (role === 'ATTORNEY') {
      where.attorneyId = userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { bookingDate: 'desc' },
      }),
      this.prisma.booking.count({ where }),
    ]);

    // Batch enrich consultationFee and attorney details
    const attorneyMap = new Map<string, any>();
    if (this.userServiceClient && items.length > 0) {
      const attorneyIds = Array.from(new Set(items.map((b) => b.attorneyId)));
      await Promise.all(
        attorneyIds.map(async (attorneyId) => {
          try {
            const profile = await this.userServiceClient?.getAttorneyProfile(
              attorneyId,
              correlationId
            );
            if (profile) {
              const rawFee = profile.consultationFee ?? profile.consultationFees;
              const fee = rawFee !== null && rawFee !== undefined ? Number(rawFee) : null;
              attorneyMap.set(attorneyId, {
                id: profile.id,
                userId: profile.userId,
                fullName: profile.user?.fullName || profile.fullName,
                photoUrl:
                  profile.user?.photoUrl || profile.photoUrl || profile.professionalPhotoUrl,
                feeBand: profile.feeBand,
                consultationFee: fee,
              });
            }
          } catch {
            // Graceful fallback
          }
        })
      );
    }

    const enrichedItems = items.map((booking) => {
      const attorney = attorneyMap.get(booking.attorneyId);
      return {
        ...booking,
        consultationFee: attorney?.consultationFee ?? null,
        attorney: attorney ?? null,
      };
    });

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findBookingById(id: string, correlationId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        bookingEvents: { orderBy: { createdAt: 'asc' } },
        bookingTimelines: { orderBy: { eventDate: 'asc' } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return this.enrichBookingWithFee(booking, correlationId);
  }

  async findOne(id: string, correlationId?: string) {
    return this.findBookingById(id, correlationId);
  }

  async updateBookingStatus(
    id: string,
    status: BookingStatus,
    updatedBy: string,
    reason?: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking with ID ${id} not found`);

      const updated = await tx.booking.update({
        where: { id },
        data: { status },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: `BOOKING_STATUS_${status}`,
          description: reason || `Status updated to ${status}`,
          createdBy: updatedBy,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: `BOOKING_${status}`,
          payload: { bookingId: id, status, reason },
        },
      });

      return updated;
    });
  }

  // =========================================================================
  // 2. DELEGATIONS: CANCELLATION, RESCHEDULE, AND DISPUTE
  // =========================================================================

  cancelBooking(id: string, userId: string, reason?: string) {
    return this.cancellationService.cancelBooking(id, userId, reason);
  }

  rescheduleBooking(
    id: string,
    data: { bookingDate: string; startTime: string; endTime: string },
    userId: string
  ) {
    return this.rescheduleService.rescheduleBooking(id, data, userId);
  }

  proposeReschedule(
    id: string,
    data: {
      proposedBookingDate: string;
      proposedStartTime: string;
      proposedEndTime: string;
      reason?: string;
    },
    userId: string
  ) {
    return this.rescheduleService.proposeReschedule(id, data, userId);
  }

  respondToReschedule(
    id: string,
    data: { action: 'ACCEPT' | 'REJECT'; reason?: string },
    userId: string
  ) {
    return this.rescheduleService.respondToReschedule(id, data, userId);
  }

  reportNoShow(id: string, userId: string, reason?: string) {
    return this.disputeService.reportNoShow(id, userId, reason);
  }

  // =========================================================================
  // 3. BLACKOUTS & REAL-TIME CHAT
  // =========================================================================

  async createBlackout(
    attorneyId: string,
    data: { startDate: string; endDate: string; reason?: string }
  ) {
    return this.prisma.availabilityBlackout.create({
      data: {
        attorneyId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reason: data.reason || 'Vacation / Blackout Period',
      },
    });
  }

  async getBlackouts(attorneyId: string) {
    return this.prisma.availabilityBlackout.findMany({
      where: { attorneyId },
      orderBy: { startDate: 'asc' },
    });
  }

  async getOrCreateBookingChat(bookingId: string, userId?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    if (this.communicationServiceClient) {
      return this.communicationServiceClient.getOrCreateBookingChat(
        booking.id,
        booking.clientId,
        booking.attorneyId,
        `Consultation - ${booking.referenceNumber || booking.id}`
      );
    }

    return {
      status: 'pending',
      bookingId: booking.id,
      clientId: booking.clientId,
      attorneyId: booking.attorneyId,
      message: 'Chat conversation created/linked with consultation',
    };
  }

  // =========================================================================
  // 4. AVAILABLE SLOTS DELEGATION & TIME HELPERS
  // =========================================================================

  getAvailableSlotsForDate(attorneyId: string, targetDateStr: string, slotDurationMinutes = 60) {
    const service =
      this.availabilityService ||
      new BookingAvailabilityService(this.prisma, this.googleMeetService, this.userServiceClient);
    return service.getAvailableSlotsForDate(attorneyId, targetDateStr, slotDurationMinutes);
  }

  parseTimeToMinutes(timeStr: string): number {
    return parseTimeToMinutes(timeStr);
  }

  formatMinutesToTime(totalMinutes: number): string {
    return formatMinutesToTime(totalMinutes);
  }

  generateTimeIntervals(
    startTime: string,
    endTime: string,
    durationMinutes: number
  ): Array<{ startTime: string; endTime: string }> {
    return generateTimeIntervals(startTime, endTime, durationMinutes);
  }
}
