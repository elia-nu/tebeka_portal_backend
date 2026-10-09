import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { CaseStatus, BookingStatus, DisputeStatus, Priority } from '@prisma/client/marketplace';
import { PrismaService } from '../../database/prisma.service';
import { CreateDisputeDto, QueryDisputeDto, ResolveDisputeDto } from './dto/dispute.dto';
import { calculateBusinessDaysSla, computeDisputeSlaMeta } from './utils/dispute-sla.util';
import { DisputeResolutionService } from './services/dispute-resolution.service';

export { calculateBusinessDaysSla };

@Injectable()
export class DisputeService {
  private readonly disputeResolutionService: DisputeResolutionService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() disputeResolutionService?: DisputeResolutionService
  ) {
    this.disputeResolutionService = disputeResolutionService || new DisputeResolutionService(this.prisma);
  }

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

    const formattedItems = items.map((item) => ({
      ...item,
      sla: computeDisputeSlaMeta(item),
    }));

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

    return {
      ...dispute,
      sla: computeDisputeSlaMeta(dispute),
    };
  }

  async resolveDispute(id: string, data: ResolveDisputeDto, adminId: string) {
    return this.disputeResolutionService.resolveDispute(id, data, adminId);
  }
}

