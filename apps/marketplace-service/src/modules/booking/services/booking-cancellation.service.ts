import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaClient, BookingStatus } from '@prisma/client/marketplace';
import { GoogleMeetService } from '../../integrations/google-meet.service';

const prisma = new PrismaClient();

@Injectable()
export class BookingCancellationService {
  constructor(
    @Optional() private readonly googleMeetService?: GoogleMeetService,
  ) {}

  async cancelBooking(id: string, userId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking is already cancelled');
      }

      if (booking.status === BookingStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel a completed consultation');
      }

      // Tiered cancellation & refund policy calculation (BR-BOOK-03)
      const dateStr =
        typeof booking.bookingDate === 'string'
          ? (booking.bookingDate as string).split('T')[0]
          : booking.bookingDate.toISOString().split('T')[0];
      const appointmentDateTime = new Date(`${dateStr}T${booking.startTime}:00`);
      const hoursUntilAppointment = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

      let refundPercentage = 0;
      let refundPolicyTier = 'NONE';
      const isAttorneyCancelling = userId === booking.attorneyId;

      if (isAttorneyCancelling) {
        // Attorney cancels -> client receives 100% full refund
        refundPercentage = 100;
        refundPolicyTier = 'ATTORNEY_FULL_REFUND';
      } else {
        // Client tiered cancellation policy
        if (hoursUntilAppointment >= 24) {
          refundPercentage = 100;
          refundPolicyTier = 'FULL_24H_PRIOR';
        } else if (hoursUntilAppointment >= 12) {
          refundPercentage = 50;
          refundPolicyTier = 'PARTIAL_12H_TO_24H';
        } else {
          refundPercentage = 0;
          refundPolicyTier = 'LATE_LESS_THAN_12H';
        }
      }

      const updated = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_CANCELLED',
          description:
            reason ||
            `Cancelled by ${isAttorneyCancelling ? 'Attorney' : 'Client'} (Refund: ${refundPercentage}% - Policy: ${refundPolicyTier})`,
          createdBy: userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_CANCELLED',
          payload: {
            bookingId: id,
            referenceNumber: booking.referenceNumber,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            cancelledBy: userId,
            isAttorneyCancelling,
            refundPercentage,
            refundPolicyTier,
            reason: reason || 'Cancelled by user',
          },
        },
      });

      // Cancel Google Calendar & Meet event
      if (booking.googleCalendarEventId && this.googleMeetService) {
        setImmediate(() => {
          this.googleMeetService?.cancelConsultationMeeting(booking.googleCalendarEventId!);
        });
      }

      return {
        ...updated,
        refundPercentage,
        refundPolicyTier,
      };
    });
  }
}
