import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleMeetService } from '../../integrations/google-meet.service';
import { UserServiceClient } from '../../../integrations/user-service.client';

@Injectable()
export class BookingRescheduleService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly googleMeetService?: GoogleMeetService,
    @Optional() private readonly userServiceClient?: UserServiceClient,
  ) {}

  private parseTimeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }

  async rescheduleBooking(
    id: string,
    data: { bookingDate: string; startTime: string; endTime: string },
    userId: string,
  ) {
    const dateStr = typeof data.bookingDate === 'string' ? data.bookingDate.split('T')[0] : data.bookingDate.toISOString().split('T')[0];
    const dateParts = dateStr.split('-').map(Number);
    if (dateParts.length !== 3 || dateParts.some(isNaN)) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    const [year, month, day] = dateParts;
    const normalizedBookingDate = new Date(Date.UTC(year, month - 1, day));
    const dayStart = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${id} not found`);
      }

      // Check Google Calendar Free/Busy if attorney has connected their calendar
      if (this.userServiceClient && this.googleMeetService) {
        try {
          const attorneyProfile = await this.userServiceClient.getAttorneyProfile(booking.attorneyId);
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
                message: 'The attorney is unavailable at the selected reschedule time (busy on Google Calendar).',
              });
            }
          }
        } catch (err: any) {
          if (err instanceof ConflictException) throw err;
        }
      }

      const existingBookingsOnDate = await tx.booking.findMany({
        where: {
          attorneyId: booking.attorneyId,
          bookingDate: { gte: dayStart, lte: dayEnd },
          id: { not: id },
          status: { in: [BookingStatus.ACCEPTED_PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.REQUESTED] },
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
          message: 'The requested reschedule time slot is already reserved / booked.',
        });
      }

      const updated = await tx.booking.update({
        where: { id },
        data: {
          bookingDate: normalizedBookingDate,
          startTime: data.startTime,
          endTime: data.endTime,
          status: BookingStatus.ACCEPTED_PENDING_PAYMENT,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_RESCHEDULED',
          description: `Rescheduled to ${data.bookingDate} ${data.startTime}`,
          createdBy: userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_RESCHEDULED',
          payload: { bookingId: id, newBookingDate: data.bookingDate, newStartTime: data.startTime },
        },
      });

      return updated;
    });
  }

  async proposeReschedule(
    id: string,
    data: { proposedBookingDate: string; proposedStartTime: string; proposedEndTime: string; reason?: string },
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.rescheduleCount >= 2) {
        throw new BadRequestException('Maximum limit of 2 reschedules reached for this booking (BR-BOOK-04)');
      }

      if (
        booking.status !== BookingStatus.CONFIRMED &&
        booking.status !== BookingStatus.ACCEPTED_PENDING_PAYMENT &&
        booking.status !== BookingStatus.REQUESTED
      ) {
        throw new BadRequestException(`Cannot propose reschedule for booking in status ${booking.status}`);
      }

      const proposedDate = new Date(data.proposedBookingDate);
      const conflict = await tx.booking.findFirst({
        where: {
          attorneyId: booking.attorneyId,
          bookingDate: proposedDate,
          startTime: data.proposedStartTime,
          id: { not: id },
          status: { in: [BookingStatus.ACCEPTED_PENDING_PAYMENT, BookingStatus.CONFIRMED] },
        },
      });

      if (conflict) {
        throw new ConflictException('The proposed reschedule time slot is unavailable.');
      }

      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12-hour acceptance window (BR-BOOK-04)

      const updated = await tx.booking.update({
        where: { id },
        data: {
          rescheduleProposedBy: userId,
          proposedBookingDate: proposedDate,
          proposedStartTime: data.proposedStartTime,
          proposedEndTime: data.proposedEndTime,
          rescheduleExpiresAt: expiresAt,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'RESCHEDULE_PROPOSED',
          description:
            data.reason ||
            `Reschedule proposed for ${data.proposedBookingDate} ${data.proposedStartTime} (expires in 12h)`,
          createdBy: userId,
        },
      });

      return updated;
    });
  }

  async respondToReschedule(
    id: string,
    data: { action: 'ACCEPT' | 'REJECT'; reason?: string },
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (!booking.proposedBookingDate) {
        throw new BadRequestException('No active reschedule proposal exists for this booking');
      }

      if (booking.rescheduleExpiresAt && booking.rescheduleExpiresAt < new Date()) {
        await tx.booking.update({
          where: { id },
          data: {
            rescheduleProposedBy: null,
            proposedBookingDate: null,
            proposedStartTime: null,
            proposedEndTime: null,
            rescheduleExpiresAt: null,
          },
        });
        throw new BadRequestException(
          'Reschedule proposal has expired after 12 hours. Original slot remains (BR-BOOK-04).',
        );
      }

      if (data.action === 'ACCEPT') {
        const updated = await tx.booking.update({
          where: { id },
          data: {
            bookingDate: booking.proposedBookingDate,
            startTime: booking.proposedStartTime!,
            endTime: booking.proposedEndTime!,
            rescheduleCount: booking.rescheduleCount + 1,
            rescheduleProposedBy: null,
            proposedBookingDate: null,
            proposedStartTime: null,
            proposedEndTime: null,
            rescheduleExpiresAt: null,
            status: BookingStatus.CONFIRMED,
          },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId: id,
            event: 'RESCHEDULE_ACCEPTED',
            description: `Reschedule accepted for ${booking.proposedBookingDate} ${booking.proposedStartTime}`,
            createdBy: userId,
          },
        });

        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Booking',
            aggregateId: id,
            eventType: 'BOOKING_RESCHEDULED',
            payload: {
              bookingId: id,
              referenceNumber: booking.referenceNumber,
              clientId: booking.clientId,
              attorneyId: booking.attorneyId,
              newBookingDate: booking.proposedBookingDate,
              newStartTime: booking.proposedStartTime,
              newEndTime: booking.proposedEndTime,
              rescheduleCount: booking.rescheduleCount + 1,
            },
          },
        });

        // Sync new schedule to Google Calendar & Meet
        if (booking.googleCalendarEventId && this.googleMeetService) {
          setImmediate(() => {
            this.googleMeetService?.updateConsultationMeeting(
              booking.googleCalendarEventId!,
              booking.proposedBookingDate!,
              booking.proposedStartTime!,
              booking.proposedEndTime!,
            );
          });
        }

        return updated;
      } else {
        const updated = await tx.booking.update({
          where: { id },
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
            bookingId: id,
            event: 'RESCHEDULE_REJECTED',
            description: data.reason || 'Reschedule proposal rejected. Original appointment remains.',
            createdBy: userId,
          },
        });

        return updated;
      }
    });
  }
}
