import {
  Injectable,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { BookingStatus, ConsultationType } from '@prisma/client/marketplace';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleMeetService } from '../../integrations/google-meet.service';
import { UserServiceClient } from '../../../integrations/user-service.client';
import { parseTimeToMinutes } from '../utils/booking-time.util';

@Injectable()
export class BookingCreationService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly googleMeetService?: GoogleMeetService,
    @Optional() private readonly userServiceClient?: UserServiceClient
  ) {}

  async enrichBookingWithFee(booking: any, correlationId?: string) {
    if (!booking) return booking;
    let consultationFee: number | null = null;
    let attorney: any = null;

    if (this.userServiceClient && booking.attorneyId) {
      try {
        const profile = await this.userServiceClient.getAttorneyProfile(
          booking.attorneyId,
          correlationId
        );
        if (profile) {
          const rawFee = profile.consultationFee ?? profile.consultationFees;
          consultationFee = rawFee !== null && rawFee !== undefined ? Number(rawFee) : null;
          attorney = {
            id: profile.id,
            userId: profile.userId,
            fullName: profile.user?.fullName || profile.fullName,
            photoUrl:
              profile.user?.photoUrl || profile.photoUrl || profile.professionalPhotoUrl,
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

  async createBooking(data: any, clientId: string, correlationId?: string) {
    if (!data.attorneyId) throw new BadRequestException('attorneyId is required');
    if (!data.bookingDate) throw new BadRequestException('bookingDate is required');
    if (!data.startTime || !data.endTime)
      throw new BadRequestException('startTime and endTime are required');

    const dateStr =
      typeof data.bookingDate === 'string'
        ? data.bookingDate.split('T')[0]
        : data.bookingDate.toISOString().split('T')[0];
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
        const attorneyProfile = await this.userServiceClient.getAttorneyProfile(
          data.attorneyId,
          correlationId
        );
        if (attorneyProfile?.isGoogleSyncEnabled && attorneyProfile?.googleRefreshToken) {
          const reqSlotStart = new Date(`${dateStr}T${data.startTime}:00+03:00`);
          const reqSlotEnd = new Date(`${dateStr}T${data.endTime}:00+03:00`);

          const busyBlocks = await this.googleMeetService.getAttorneyBusyIntervals(
            attorneyProfile.googleRefreshToken,
            dayStart,
            dayEnd,
            attorneyProfile.googleCalendarId || 'primary'
          );

          const hasGoogleConflict = busyBlocks.some(
            (b) => reqSlotStart < b.end && reqSlotEnd > b.start
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
    const createdBooking = await this.prisma.$transaction(async (tx) => {
      const existingBookingsOnDate = await tx.booking.findMany({
        where: {
          attorneyId: data.attorneyId,
          bookingDate: { gte: dayStart, lte: dayEnd },
          status: {
            in: [
              BookingStatus.CONFIRMED,
              BookingStatus.ACCEPTED_PENDING_PAYMENT,
              BookingStatus.REQUESTED,
            ],
          },
        },
      });

      const newStartMinutes = parseTimeToMinutes(data.startTime);
      const newEndMinutes = parseTimeToMinutes(data.endTime);

      const hasBookingConflict = existingBookingsOnDate.some((b) => {
        const bStart = parseTimeToMinutes(b.startTime);
        const bEnd = parseTimeToMinutes(b.endTime);
        return newStartMinutes < bEnd && newEndMinutes > bStart;
      });

      if (hasBookingConflict) {
        throw new ConflictException({
          code: 'BOOKING_SLOT_CONFLICT',
          message: 'The selected time slot is already reserved / booked.',
        });
      }

      const bookingCount = await tx.booking.count();
      const referenceNumber = `CONS-${new Date().getFullYear()}-${String(bookingCount + 1).padStart(
        6,
        '0'
      )}`;

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

    return this.enrichBookingWithFee(createdBooking, correlationId);
  }
}
