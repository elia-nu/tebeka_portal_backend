import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, BookingStatus } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class BookingDisputeService {
  async reportNoShow(id: string, userId: string, reason?: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id } });
      if (!booking) throw new NotFoundException(`Booking ${id} not found`);

      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new BadRequestException(`Cannot mark booking in ${booking.status} status as No-Show.`);
      }

      const isClientReporting = userId === booking.clientId;
      const faultParty = isClientReporting ? 'ATTORNEY' : 'CLIENT';
      const refundPercentage = isClientReporting ? 100 : 0; // Attorney no-show -> 100% refund; Client no-show -> 0% refund

      const updated = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.NOSHOW,
          noShowReportedBy: userId,
          noShowReason: reason || `No-show reported by ${isClientReporting ? 'Client' : 'Attorney'}`,
        },
      });

      await tx.bookingEvent.create({
        data: {
          bookingId: id,
          event: 'BOOKING_NOSHOW',
          description: reason || `Marked as No-Show. Fault Party: ${faultParty} (Refund: ${refundPercentage}%)`,
          createdBy: userId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: id,
          eventType: 'BOOKING_NOSHOW',
          payload: {
            bookingId: id,
            referenceNumber: booking.referenceNumber,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            reportedBy: userId,
            faultParty,
            refundPercentage,
            reason: reason || 'Participant failed to attend scheduled consultation',
          },
        },
      });

      return {
        ...updated,
        faultParty,
        refundPercentage,
      };
    });
  }
}
