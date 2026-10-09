import { Injectable, BadRequestException, Optional } from '@nestjs/common';
import { BookingStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleMeetService } from '../../integrations/google-meet.service';
import { UserServiceClient } from '../../../integrations/user-service.client';
import {
  parseTimeToMinutes,
  generateTimeIntervals,
} from '../utils/booking-time.util';

@Injectable()
export class BookingAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly googleMeetService?: GoogleMeetService,
    @Optional() private readonly userServiceClient?: UserServiceClient
  ) {}

  async getAvailableSlotsForDate(
    attorneyId: string,
    targetDateStr: string,
    slotDurationMinutes = 60
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

    const weekday = targetDate.getUTCDay();
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

    // 3. Fetch existing confirmed / active portal bookings for this date
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        attorneyId,
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
            attorneyProfile.googleCalendarId || 'primary'
          );
        }
      } catch {
        // Fallback silently if user-service is temporarily unavailable
      }
    }

    // 5. Generate candidate slots from working hours
    const candidateSlots = generateTimeIntervals(
      workingStartTime,
      workingEndTime,
      slotDurationMinutes
    );

    // 6. Filter out slots colliding with either portal bookings or Google Calendar busy intervals
    const availableSlots = candidateSlots.filter((slot) => {
      const slotStartMinutes = parseTimeToMinutes(slot.startTime);
      const slotEndMinutes = parseTimeToMinutes(slot.endTime);

      // Check collision with portal bookings
      const hasBookingConflict = existingBookings.some((b) => {
        const bStart = parseTimeToMinutes(b.startTime);
        const bEnd = parseTimeToMinutes(b.endTime);
        return slotStartMinutes < bEnd && slotEndMinutes > bStart;
      });
      if (hasBookingConflict) return false;

      // Check collision with Google Calendar busy intervals
      const slotStartDate = new Date(`${dateFormatted}T${slot.startTime}:00+03:00`);
      const slotEndDate = new Date(`${dateFormatted}T${slot.endTime}:00+03:00`);

      const hasGoogleConflict = googleBusyIntervals.some(
        (busy) => slotStartDate < busy.end && slotEndDate > busy.start
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
