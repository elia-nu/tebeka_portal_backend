import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleMeetService } from '../../integrations/google-meet.service';

@Injectable()
export class BookingCancellationService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly googleMeetService?: GoogleMeetService,
  ) {}

  async cancelBooking(id: string, userId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking is already cancelled');
      }

      if (booking.status === BookingStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel a completed consultation');
      }

      // Tiered cancellation & refund policy calculation (SRS v3.0 BR-BOOK-02/03 & OQ#1/2)
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
        // Attorney cancels -> client receives 100% full refund + reliability tracking penalty
        refundPercentage = 100;
        refundPolicyTier = 'ATTORNEY_FULL_REFUND';
      } else {
        // Client cancellation: >=24h 100% full refund; <24h 50% partial refund per governing SRS v3.0 policy
        if (hoursUntilAppointment >= 24) {
          refundPercentage = 100;
          refundPolicyTier = 'FULL_24H_PRIOR';
        } else {
          refundPercentage = 50;
          refundPolicyTier = 'PARTIAL_UNDER_24H';
        }
      }

      const cancelledByRole = isAttorneyCancelling ? 'ATTORNEY' : 'CLIENT';
      const policyVersion = 'v3.0-OQ1/2';
      const originalAmountSantim = BigInt(150000); // 1500 ETB = 150,000 santim
      const refundAmountSantim = (originalAmountSantim * BigInt(refundPercentage)) / BigInt(100);

      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          policyVersion,
          cancelledByRole,
          refundTier: refundPolicyTier,
          refundAmountSantim,
        },
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
            cancelledByRole,
            policyVersion,
            isAttorneyCancelling,
            refundPercentage,
            refundPolicyTier,
            refundAmountSantim: refundAmountSantim.toString(),
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
        policyVersion,
        cancelledByRole,
        refundPercentage,
        refundPolicyTier,
        refundTier: refundPolicyTier,
        refundAmountSantim,
      };
    });
  }
}
