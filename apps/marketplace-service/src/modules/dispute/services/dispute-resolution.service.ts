import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CaseStatus, BookingStatus, DisputeStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../../database/prisma.service';
import { ResolveDisputeDto } from '../dto/dispute.dto';

@Injectable()
export class DisputeResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDispute(id: string, data: ResolveDisputeDto, adminId: string) {
    if (!data.resolutionOutcome || !data.resolutionOutcome.trim()) {
      throw new BadRequestException('Resolution outcome is required');
    }
    if (!data.resolutionNotes || !data.resolutionNotes.trim()) {
      throw new BadRequestException('Resolution notes and reason are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.findUnique({
        where: { id },
        include: { case: true, booking: true },
      });

      if (!dispute) {
        throw new NotFoundException(`Dispute ${id} not found`);
      }

      const targetStatus = data.status || DisputeStatus.RESOLVED;

      const updatedDispute = await tx.dispute.update({
        where: { id },
        data: {
          status: targetStatus,
          resolutionOutcome: data.resolutionOutcome.trim(),
          resolutionNotes: data.resolutionNotes.trim(),
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });

      // Update Case status if applicable
      if (dispute.caseId) {
        const newCaseStatus = data.caseStatusAction
          ? (data.caseStatusAction as CaseStatus)
          : targetStatus === DisputeStatus.RESOLVED
          ? CaseStatus.RESOLVED
          : CaseStatus.IN_PROGRESS;

        await tx.case.update({
          where: { id: dispute.caseId },
          data: {
            status: newCaseStatus,
            ...(newCaseStatus === CaseStatus.CLOSED && { closedAt: new Date() }),
          },
        });

        await tx.caseTimeline.create({
          data: {
            caseId: dispute.caseId,
            title: `Dispute ${targetStatus} (${dispute.referenceNumber})`,
            description: `Admin Resolution: ${data.resolutionOutcome}. Notes: ${data.resolutionNotes}`,
            eventDate: new Date(),
          },
        });
      }

      // Update Booking status if applicable
      if (dispute.bookingId) {
        const newBookingStatus = data.bookingStatusAction
          ? (data.bookingStatusAction as BookingStatus)
          : targetStatus === DisputeStatus.RESOLVED
          ? BookingStatus.COMPLETED
          : BookingStatus.CONFIRMED;

        await tx.booking.update({
          where: { id: dispute.bookingId },
          data: { status: newBookingStatus },
        });

        await tx.bookingEvent.create({
          data: {
            bookingId: dispute.bookingId,
            event: 'DISPUTE_RESOLVED',
            description: `Dispute ${targetStatus}: ${data.resolutionOutcome}. Status set to ${newBookingStatus}.`,
            createdBy: adminId,
          },
        });
      }

      // Emitted OutboxEvent
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Dispute',
          aggregateId: id,
          eventType: 'DISPUTE_RESOLVED',
          payload: {
            disputeId: id,
            referenceNumber: dispute.referenceNumber,
            targetType: dispute.targetType,
            caseId: dispute.caseId,
            bookingId: dispute.bookingId,
            status: targetStatus,
            resolutionOutcome: data.resolutionOutcome,
            resolutionNotes: data.resolutionNotes,
            resolvedBy: adminId,
          },
        },
      });

      return {
        success: true,
        message: `Dispute ${dispute.referenceNumber} resolved successfully.`,
        dispute: updatedDispute,
      };
    });
  }
}
