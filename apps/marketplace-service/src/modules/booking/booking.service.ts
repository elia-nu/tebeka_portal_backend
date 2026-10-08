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

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cancellationService: BookingCancellationService,
    private readonly rescheduleService: BookingRescheduleService,
    private readonly disputeService: BookingDisputeService,
    @Optional() private readonly communicationServiceClient?: CommunicationServiceClient,
    @Optional() private readonly googleMeetService?: GoogleMeetService,
    @Optional() private readonly userServiceClient?: UserServiceClient,
  ) {}

  // =========================================================================
  // 1. CORE BOOKING CREATION & LIFECYCLE
  // =========================================================================

  async createBooking(data: any, clientId: string) {
    if (!data.attorneyId) throw new BadRequestException('attorneyId is required');
    if (!data.bookingDate) throw new BadRequestException('bookingDate is required');
    if (!data.startTime || !data.endTime) throw new BadRequestException('startTime and endTime are required');

    const dateStr = typeof data.bookingDate === 'string' ? data.bookingDate.split('T')[0] : data.bookingDate.toISOString().split('T')[0];
    const dateParts = dateStr.split('-').map(Number);
    if (dateParts.length !== 3 || dateParts.some(isNaN)) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    const [year, month, day] = dateParts;
    const normalizedBookingDate = new Date(Date.UTC(year, month - 1, day));
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Check Google Calendar Free/Busy if attorney has connected their calendar
    if (this.userServiceClient && this.googleMeetService) {
      try {
        const attorneyProfile = await this.userServiceClient.getAttorneyProfile(data.attorneyId);
        if (attorneyProfile?.isGoogleSyncEnabled && attorneyProfile?.googleRefreshToken) {
          const reqSlotStart = new Date(`${dateStr}T${data.startTime}:00+03:00`);
          const reqSlotEnd = new Date(`${dateStr}T${data.endTime}:00+03:00`);

          const busyBlocks = await this.googleMeetService.getAttorneyBusyIntervals(
            attorneyProfile.googleRefreshToken,
            dayStart,
            dayEnd,
            attorneyProfile.googleCalendarId || 'primary',
          );

          const hasGoogleConflict = busyBlocks.some(
            (b) => reqSlotStart < b.end && reqSlotEnd > b.start,
          );

          if (hasGoogleConflict) {
            throw new ConflictException({
              code: 'GOOGLE_CALENDAR_BUSY',
              message: 'The attorney is unavailable at the selected time (busy on Google Calendar).',
            });
          }
        }
      } catch (err: any) {
        if (err instanceof ConflictException) throw err;
      }
    }

    // Double booking & reservation conflict prevention inside Interactive Transaction
    return this.prisma.$transaction(async (tx) => {
      const existingBookingsOnDate = await tx.booking.findMany({
        where: {
          attorneyId: data.attorneyId,
          bookingDate: { gte: dayStart, lte: dayEnd },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACCEPTED_PENDING_PAYMENT, BookingStatus.REQUESTED] },
        },
      });

      const newStartMinutes = this.parseTimeToMinutes(data.startTime);
      const newEndMinutes = this.parseTimeToMinutes(data.endTime);

      const hasBookingConflict = existingBookingsOnDate.some((b) => {
        const bStart = this.parseTimeToMinutes(b.startTime);
        const bEnd = this.parseTimeToMinutes(b.endTime);
        return newStartMinutes < bEnd && newEndMinutes > bStart;
      });

      if (hasBookingConflict) {
        throw new ConflictException({
          code: 'BOOKING_SLOT_CONFLICT',
          message: 'The selected time slot is already reserved / booked.',
        });
      }

      const bookingCount = await tx.booking.count();
      const referenceNumber = `CONS-${new Date().getFullYear()}-${String(bookingCount + 1).padStart(6, '0')}`;

      const booking = await tx.booking.create({
        data: {
          referenceNumber,
          clientId,
          attorneyId: data.attorneyId,
          availabilityId: data.availabilityId || null,
          bookingDate: normalizedBookingDate,
          startTime: data.startTime,
          endTime: data.endTime,
          consultationType: data.consultationType || ConsultationType.VIDEO,
          status: BookingStatus.REQUESTED,
          paymentStatus: data.paymentStatus || 'UNPAID',
          meetingLink: data.meetingLink || null,
          issueBrief: data.issueBrief || data.notes || null,
          notes: data.notes || null,
          bookingEvents: {
            create: {
              event: 'BOOKING_REQUESTED',
              description: `Booking requested with reference ${referenceNumber} by client ${clientId}`,
              createdBy: clientId,
            },
          },
          bookingTimelines: {
            create: {
              title: 'Consultation Requested',
              description: `Consultation requested with reference ${referenceNumber}`,
              eventDate: new Date(),
            },
          },
        },
      });

      // Write event to Outbox table
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: booking.id,
          eventType: 'BOOKING_REQUESTED',
          payload: {
            bookingId: booking.id,
            clientId,
            attorneyId: data.attorneyId,
            bookingDate: booking.bookingDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
          },
        },
      });

      return booking;
    });
  }

  async acceptBooking(id: string, attorneyId: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.attorneyId !== attorneyId) {
        throw new ForbiddenException('You can only accept bookings requested for you');
      }

      if (booking.status !== BookingStatus.REQUESTED) {
        throw new BadRequestException(`Cannot accept booking in ${booking.status} status`);
      }

      const updated = await tx.booking.update({
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

      return updated;
    });
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
            const profile = await this.userServiceClient?.getAttorneyProfile(attorneyId, correlationId);
            if (profile) {
              const fee = Number(profile.consultationFee || profile.consultationFees || 0);
              attorneyMap.set(attorneyId, {
                id: profile.id,
                userId: profile.userId,
                fullName: profile.user?.fullName || profile.fullName,
                photoUrl: profile.user?.photoUrl || profile.photoUrl || profile.professionalPhotoUrl,
                feeBand: profile.feeBand,
                consultationFee: fee,
              });
            }
          } catch {
            // Graceful fallback
          }
        }),
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

    let consultationFee: number | null = null;
    let attorney: any = null;

    if (this.userServiceClient) {
      try {
        const profile = await this.userServiceClient.getAttorneyProfile(booking.attorneyId, correlationId);
        if (profile) {
          consultationFee = Number(profile.consultationFee || profile.consultationFees || 0);
          attorney = {
            id: profile.id,
            userId: profile.userId,
            fullName: profile.user?.fullName || profile.fullName,
            photoUrl: profile.user?.photoUrl || profile.photoUrl || profile.professionalPhotoUrl,
            feeBand: profile.feeBand,
            consultationFee,
          };
        }
      } catch {
        // Graceful fallback
      }
    }

    return {
      ...booking,
      consultationFee,
      attorney,
    };
  }

  async findOne(id: string, correlationId?: string) {
    return this.findBookingById(id, correlationId);
  }

  async updateBookingStatus(id: string, status: BookingStatus, updatedBy: string, reason?: string) {
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

  rescheduleBooking(id: string, data: { bookingDate: string; startTime: string; endTime: string }, userId: string) {
    return this.rescheduleService.rescheduleBooking(id, data, userId);
  }

  proposeReschedule(
    id: string,
    data: { proposedBookingDate: string; proposedStartTime: string; proposedEndTime: string; reason?: string },
    userId: string,
  ) {
    return this.rescheduleService.proposeReschedule(id, data, userId);
  }

  respondToReschedule(id: string, data: { action: 'ACCEPT' | 'REJECT'; reason?: string }, userId: string) {
    return this.rescheduleService.respondToReschedule(id, data, userId);
  }

  reportNoShow(id: string, userId: string, reason?: string) {
    return this.disputeService.reportNoShow(id, userId, reason);
  }

  // =========================================================================
  // 3. BLACKOUTS & REAL-TIME CHAT
  // =========================================================================

  async createBlackout(attorneyId: string, data: { startDate: string; endDate: string; reason?: string }) {
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
        `Consultation - ${booking.referenceNumber || booking.id}`,
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
  // 4. DYNAMIC AVAILABLE SLOTS (GOOGLE FREE/BUSY + BLACKOUTS + WEEKLY WINDOWS)
  // =========================================================================

  private parseTimeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private formatMinutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  private generateTimeIntervals(startTime: string, endTime: string, durationMinutes: number): Array<{ startTime: string; endTime: string }> {
    const startMin = this.parseTimeToMinutes(startTime);
    const endMin = this.parseTimeToMinutes(endTime);
    const slots: Array<{ startTime: string; endTime: string }> = [];

    let current = startMin;
    while (current + durationMinutes <= endMin) {
      slots.push({
        startTime: this.formatMinutesToTime(current),
        endTime: this.formatMinutesToTime(current + durationMinutes),
      });
      current += durationMinutes;
    }

    return slots;
  }

  async getAvailableSlotsForDate(
    attorneyId: string,
    targetDateStr: string,
    slotDurationMinutes = 60,
  ) {
    const dateParts = targetDateStr.split('-').map(Number);
    if (dateParts.length !== 3 || dateParts.some(isNaN)) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    const [year, month, day] = dateParts;
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }

    const weekday = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
    const dateFormatted = targetDate.toISOString().split('T')[0];

    // 1. Check if the date is blocked by an attorney blackout / vacation
    const blackout = await this.prisma.availabilityBlackout.findFirst({
      where: {
        attorneyId,
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
    });

    if (blackout) {
      return {
        attorneyId,
        date: dateFormatted,
        weekday,
        isAvailable: false,
        reason: blackout.reason || 'Attorney is on vacation / blackout',
        workingHours: null as { startTime: string; endTime: string } | null,
        slotDurationMinutes,
        isGoogleSyncActive: false,
        availableSlotsCount: 0,
        availableSlots: [] as Array<{ startTime: string; endTime: string }>,
      };
    }

    // 2. Fetch the attorney's weekly recurring availability window for this weekday
    const window = await this.prisma.availabilityWindow.findFirst({
      where: {
        attorneyId,
        weekday,
        isAvailable: true,
      },
    });

    // No hardcoded fallback: if no availability window is configured in DB, attorney is unavailable
    const workingStartTime = window?.startTime || null;
    const workingEndTime = window?.endTime || null;

    if (!workingStartTime || !workingEndTime) {
      return {
        attorneyId,
        date: dateFormatted,
        weekday,
        isAvailable: false,
        reason: 'Attorney does not have working hours configured for this day',
        workingHours: null as { startTime: string; endTime: string } | null,
        slotDurationMinutes,
        isGoogleSyncActive: false,
        availableSlotsCount: 0,
        availableSlots: [] as Array<{ startTime: string; endTime: string }>,
      };
    }

    // 3. Fetch existing confirmed / active portal bookings for this date (covers full UTC day range)
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        attorneyId,
        bookingDate: { gte: dayStart, lte: dayEnd },
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.ACCEPTED_PENDING_PAYMENT, BookingStatus.REQUESTED] },
      },
    });

    // 4. Fetch Google Calendar Free/Busy if connected
    let googleBusyIntervals: Array<{ start: Date; end: Date }> = [];
    let isGoogleSyncActive = false;

    if (this.userServiceClient && this.googleMeetService) {
      try {
        const attorneyProfile = await this.userServiceClient.getAttorneyProfile(attorneyId);
        if (attorneyProfile?.isGoogleSyncEnabled && attorneyProfile?.googleRefreshToken) {
          isGoogleSyncActive = true;
          const gDayStart = new Date(`${dateFormatted}T00:00:00+03:00`);
          const gDayEnd = new Date(`${dateFormatted}T23:59:59+03:00`);

          googleBusyIntervals = await this.googleMeetService.getAttorneyBusyIntervals(
            attorneyProfile.googleRefreshToken,
            gDayStart,
            gDayEnd,
            attorneyProfile.googleCalendarId || 'primary',
          );
        }
      } catch (err: any) {
        // Fallback silently if user-service is temporarily unavailable
      }
    }

    // 5. Generate candidate slots from working hours
    const candidateSlots = this.generateTimeIntervals(workingStartTime, workingEndTime, slotDurationMinutes);

    // 6. Filter out slots colliding with either portal bookings or Google Calendar busy intervals
    const availableSlots = candidateSlots.filter((slot) => {
      const slotStartMinutes = this.parseTimeToMinutes(slot.startTime);
      const slotEndMinutes = this.parseTimeToMinutes(slot.endTime);

      // Check collision with portal bookings
      const hasBookingConflict = existingBookings.some((b) => {
        const bStart = this.parseTimeToMinutes(b.startTime);
        const bEnd = this.parseTimeToMinutes(b.endTime);
        return slotStartMinutes < bEnd && slotEndMinutes > bStart;
      });
      if (hasBookingConflict) return false;

      // Check collision with Google Calendar busy intervals
      const slotStartDate = new Date(`${dateFormatted}T${slot.startTime}:00+03:00`);
      const slotEndDate = new Date(`${dateFormatted}T${slot.endTime}:00+03:00`);

      const hasGoogleConflict = googleBusyIntervals.some(
        (busy) => slotStartDate < busy.end && slotEndDate > busy.start,
      );
      if (hasGoogleConflict) return false;

      return true;
    });

    const isAvailable = availableSlots.length > 0;

    return {
      attorneyId,
      date: dateFormatted,
      weekday,
      isAvailable,
      ...(isAvailable
        ? {}
        : {
            reason:
              existingBookings.length > 0
                ? 'All slots for this date are already reserved / booked'
                : 'No available slots for this date',
          }),
      workingHours: { startTime: workingStartTime, endTime: workingEndTime },
      slotDurationMinutes,
      isGoogleSyncActive,
      availableSlotsCount: availableSlots.length,
      availableSlots,
    };
  }
}
