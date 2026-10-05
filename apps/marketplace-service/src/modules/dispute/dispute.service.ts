import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CaseStatus, BookingStatus, DisputeStatus, Priority } from '@prisma/client/marketplace';
import { PrismaService } from '../../database/prisma.service';
import { CreateDisputeDto, QueryDisputeDto, ResolveDisputeDto } from './dto/dispute.dto';

// Helper to compute 5 business days SLA deadline
export function calculateBusinessDaysSla(startDate: Date, businessDays: number = 5): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  while (daysAdded < businessDays) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  return result;
}

@Injectable()
export class DisputeService {
  constructor(private readonly prisma: PrismaService) {}

  async openCaseDispute(caseId: string, data: CreateDisputeDto, userId: string) {
    if (!data.reason || !data.reason.trim()) {
      throw new BadRequestException('Dispute reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id: caseId },
        include: { agreement: true },
      });

      if (!caseItem) {
        throw new NotFoundException(`Legal Case ${caseId} not found`);
      }

      const isClient = caseItem.clientId === userId;
      const isAttorney = caseItem.attorneyId === userId;
      if (!isClient && !isAttorney) {
        throw new ForbiddenException('Only the client or assigned attorney can open a dispute on this case.');
      }

      // Check for already open dispute
      const existingOpenDispute = await tx.dispute.findFirst({
        where: {
          caseId,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
        },
      });
      if (existingOpenDispute) {
        throw new BadRequestException(`An active dispute (${existingOpenDispute.referenceNumber}) is already pending on this case.`);
      }

      const count = await tx.dispute.count();
      const referenceNumber = `DISP-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
      const slaDeadline = calculateBusinessDaysSla(new Date(), 5);

      // 1. Update Case status to DISPUTED (FR-CASE-06)
      const updatedCase = await tx.case.update({
        where: { id: caseId },
        data: { status: CaseStatus.DISPUTED },
      });

      // 2. Create Dispute queue record
      const dispute = await tx.dispute.create({
        data: {
          referenceNumber,
          caseId,
          targetType: 'CASE',
          openedBy: userId,
          reason: data.reason.trim(),
          details: data.details ? data.details.trim() : null,
          evidenceUrls: data.evidenceUrls || [],
          status: DisputeStatus.OPEN,
          priority: data.priority || Priority.HIGH,
          slaDeadline,
        },
      });

      // 3. Record timeline event
      const filerRole = isClient ? 'Client' : 'Attorney';
      await tx.caseTimeline.create({
        data: {
          caseId,
          title: `Dispute Escalated (${referenceNumber})`,
          description: `Dispute opened by ${filerRole}. Reason: ${data.reason.trim()}. 5-business-day admin SLA target active.`,
          eventDate: new Date(),
        },
      });

      // 4. Record OutboxEvent for notifications & audit
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: caseId,
          eventType: 'CASE_DISPUTED',
          payload: {
            disputeId: dispute.id,
            referenceNumber,
            caseId,
            clientId: caseItem.clientId,
            attorneyId: caseItem.attorneyId,
            openedBy: userId,
            reason: data.reason,
            slaDeadline: slaDeadline.toISOString(),
          },
        },
      });

      return {
        success: true,
        message: 'Case successfully escalated to admin dispute queue with 5 business days first response SLA.',
        dispute,
        case: updatedCase,
      };
    });
  }

  async openBookingDispute(bookingId: string, data: CreateDisputeDto, userId: string) {
    if (!data.reason || !data.reason.trim()) {
      throw new BadRequestException('Dispute reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${bookingId} not found`);
      }

      const isClient = booking.clientId === userId;
      const isAttorney = booking.attorneyId === userId;
      if (!isClient && !isAttorney) {
        throw new ForbiddenException('Only the client or booked attorney can open a dispute on this booking.');
      }

      const existingOpenDispute = await tx.dispute.findFirst({
        where: {
          bookingId,
          status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] },
        },
      });
      if (existingOpenDispute) {
        throw new BadRequestException(`An active dispute (${existingOpenDispute.referenceNumber}) is already pending on this booking.`);
      }

      const count = await tx.dispute.count();
      const referenceNumber = `DISP-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
      const slaDeadline = calculateBusinessDaysSla(new Date(), 5);

      // 1. Update Booking status to DISPUTED (freezes escrow release per TC-PAY-02)
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.DISPUTED },
      });

      // 2. Create Dispute queue record
      const dispute = await tx.dispute.create({
        data: {
          referenceNumber,
          bookingId,
          targetType: 'BOOKING',
          openedBy: userId,
          reason: data.reason.trim(),
          details: data.details ? data.details.trim() : null,
          evidenceUrls: data.evidenceUrls || [],
          status: DisputeStatus.OPEN,
          priority: data.priority || Priority.HIGH,
          slaDeadline,
        },
      });

      // 3. Record Booking Event and Timeline
      await tx.bookingEvent.create({
        data: {
          bookingId,
          event: 'BOOKING_DISPUTED',
          description: `Dispute opened (${referenceNumber}). Reason: ${data.reason.trim()}. Escrow payout frozen.`,
          createdBy: userId,
        },
      });

      await tx.bookingTimeline.create({
        data: {
          bookingId,
          title: `Dispute Escalated (${referenceNumber})`,
          description: `Dispute opened by ${isClient ? 'Client' : 'Attorney'}. Reason: ${data.reason.trim()}`,
          eventDate: new Date(),
        },
      });

      // 4. Outbox Event
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Booking',
          aggregateId: bookingId,
          eventType: 'BOOKING_DISPUTED',
          payload: {
            disputeId: dispute.id,
            referenceNumber,
            bookingId,
            clientId: booking.clientId,
            attorneyId: booking.attorneyId,
            openedBy: userId,
            reason: data.reason,
            slaDeadline: slaDeadline.toISOString(),
          },
        },
      });

      return {
        success: true,
        message: 'Booking consultation escalated to admin dispute queue. Escrow release frozen pending admin resolution.',
        dispute,
        booking: updatedBooking,
      };
    });
  }

  async getDisputes(query: QueryDisputeDto = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.targetType && query.targetType !== 'ALL') where.targetType = query.targetType;
    if (query.caseId) where.caseId = query.caseId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.openedBy) where.openedBy = query.openedBy;

    if (query.search) {
      where.OR = [
        { referenceNumber: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
        { details: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const allowedSortFields = ['createdAt', 'priority', 'slaDeadline', 'status'];
    const sortBy = allowedSortFields.includes(query.sortBy || '') ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        include: {
          case: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              status: true,
              clientId: true,
              attorneyId: true,
            },
          },
          booking: {
            select: {
              id: true,
              referenceNumber: true,
              bookingDate: true,
              status: true,
              clientId: true,
              attorneyId: true,
            },
          },
        },
        orderBy: { [sortBy as any]: sortOrder },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    const now = Date.now();
    const formattedItems = items.map((item) => {
      const slaDeadlineMs = new Date(item.slaDeadline).getTime();
      const isOpenOrUnderReview = item.status === DisputeStatus.OPEN || item.status === DisputeStatus.UNDER_REVIEW;
      const isBreached = isOpenOrUnderReview && now > slaDeadlineMs;
      const remainingMs = Math.max(0, slaDeadlineMs - now);

      return {
        ...item,
        sla: {
          targetBusinessDays: 5,
          slaDeadline: item.slaDeadline,
          isBreached,
          remainingHours: isOpenOrUnderReview ? Math.round(remainingMs / (1000 * 60 * 60)) : 0,
        },
      };
    });

    const [openCount, underReviewCount, resolvedCount, dismissedCount] = await Promise.all([
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.UNDER_REVIEW } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.DISMISSED } }),
    ]);

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        openCount,
        underReviewCount,
        resolvedCount,
        dismissedCount,
        totalActive: openCount + underReviewCount,
      },
    };
  }

  async getDisputeById(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        case: {
          include: {
            caseDocuments: true,
            caseMilestones: true,
            caseTimelines: true,
            agreement: true,
          },
        },
        booking: {
          include: {
            bookingEvents: true,
            bookingTimelines: true,
          },
        },
      },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }

    const now = Date.now();
    const slaDeadlineMs = new Date(dispute.slaDeadline).getTime();
    const isOpenOrUnderReview = dispute.status === DisputeStatus.OPEN || dispute.status === DisputeStatus.UNDER_REVIEW;
    const isBreached = isOpenOrUnderReview && now > slaDeadlineMs;

    return {
      ...dispute,
      sla: {
        targetBusinessDays: 5,
        slaDeadline: dispute.slaDeadline,
        isBreached,
        remainingHours: isOpenOrUnderReview ? Math.round(Math.max(0, slaDeadlineMs - now) / (1000 * 60 * 60)) : 0,
      },
    };
  }

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
