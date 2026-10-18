import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { CaseStatus, Priority, AgreementStatus, AgreementType, MilestoneStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../database/prisma.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';
import { SignAgreementDto, DeclineAgreementDto } from './dto/agreement.dto';
import { ProposeMilestonesDto, ApproveMilestonesDto, AcknowledgeMilestoneDto, CompleteMilestoneDto } from './dto/case.dto';
import { DEFAULT_AGREEMENT_TERMS } from './constants/agreement-terms.constant';
import { CaseAgreementService } from './services/case-agreement.service';

export { DEFAULT_AGREEMENT_TERMS };

@Injectable()
export class CaseService {
  private readonly agreementService: CaseAgreementService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly communicationServiceClient?: CommunicationServiceClient,
    @Optional() caseAgreementService?: CaseAgreementService
  ) {
    this.agreementService = caseAgreementService || new CaseAgreementService(this.prisma, this.communicationServiceClient);
  }

  async createCase(data: any, clientId: string) {
    if (!data.title) throw new BadRequestException('Case title is required');
    if (!data.description) throw new BadRequestException('Case description is required');
    if (!data.attorneyId) throw new BadRequestException('attorneyId is required');

    // Interactive Transaction: Validate booking, create case, milestones, agreement, link booking, persist OutboxEvent inside tx
    return this.prisma.$transaction(async (tx) => {
      if (data.bookingId) {
        const booking = await tx.booking.findUnique({
          where: { id: data.bookingId },
        });
        if (!booking) {
          throw new NotFoundException(`Associated booking ${data.bookingId} not found`);
        }
      }

      const caseCount = await tx.case.count();
      const referenceNumber = `CASE-${new Date().getFullYear()}-${String(caseCount + 1).padStart(6, '0')}`;

      const caseItem = await tx.case.create({
        data: {
          referenceNumber,
          bookingId: data.bookingId || null,
          clientId,
          attorneyId: data.attorneyId,
          practiceAreaId: data.practiceAreaId || null,
          title: data.title,
          description: data.description,
          category: data.category || null,
          tags: data.tags || [],
          priority: data.priority || Priority.MEDIUM,
          status: CaseStatus.OPEN,
          opposingPartyName: data.opposingPartyName || null,
          involvedOrganization: data.involvedOrganization || null,
          conflictAcknowledged: Boolean(data.conflictAcknowledged),
          timeSensitiveDate: data.timeSensitiveDate ? new Date(data.timeSensitiveDate) : null,
          urgencyReason: data.urgencyReason || null,
          agreement: {
            create: {
              agreementType: AgreementType.CASE_ENGAGEMENT_NON_CIRCUMVENTION,
              version: 1,
              termsContent: DEFAULT_AGREEMENT_TERMS,
              status: AgreementStatus.PENDING_SIGNATURES,
            },
          },
          caseTimelines: {
            create: [
              {
                title: 'Case Initialized',
                description: `Case registered with reference ${referenceNumber}. Tri-Party Agreement Room created.`,
                eventDate: new Date(),
              },
            ],
          },
        },
        include: { caseDocuments: true, caseMilestones: true, caseTimelines: true, agreement: true },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: caseItem.id,
          eventType: 'CASE_CREATED',
          payload: { caseId: caseItem.id, referenceNumber, clientId, attorneyId: data.attorneyId, title: data.title },
        },
      });

      return caseItem;
    });
  }

  async findUserCases(userId: string, role: string, query: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role-based scope
    if (role === 'ATTORNEY') {
      where.attorneyId = userId;
    } else if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      where.clientId = userId;
    }

    // Model-driven filters
    if (query.clientId) where.clientId = query.clientId;
    if (query.attorneyId) where.attorneyId = query.attorneyId;
    if (query.practiceAreaId) where.practiceAreaId = query.practiceAreaId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    if (query.q || query.search) {
      const searchTerm = query.q || query.search;
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (query.fromOpenedAt || query.toOpenedAt) {
      where.openedAt = {};
      if (query.fromOpenedAt) where.openedAt.gte = new Date(query.fromOpenedAt);
      if (query.toOpenedAt) where.openedAt.lte = new Date(query.toOpenedAt);
    }

    // Dynamic sorting
    const allowedSortFields = ['openedAt', 'closedAt', 'priority', 'title'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'openedAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.case.findMany({
        where,
        skip,
        take: limit,
        include: { caseDocuments: true, caseMilestones: true },
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.case.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const caseItem = await this.prisma.case.findUnique({
      where: { id },
      include: { caseDocuments: true, caseMilestones: true, booking: true },
    });
    if (!caseItem) throw new NotFoundException(`Legal Case ${id} not found`);
    return caseItem;
  }

  async updateCaseStatus(id: string, newStatus: CaseStatus, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id },
        include: { caseMilestones: true },
      });

      if (!caseItem) {
        throw new NotFoundException(`Legal Case ${id} not found`);
      }

      // State machine guard for FR-CASE-04: Cannot transition to IN_PROGRESS unless client approved milestones
      if (newStatus === CaseStatus.IN_PROGRESS) {
        if (!caseItem.caseMilestones || caseItem.caseMilestones.length === 0) {
          throw new BadRequestException(
            'Case cannot transition to IN_PROGRESS: Milestones must be proposed by attorney and approved by client (FR-CASE-04).'
          );
        }
        const hasUnapproved = caseItem.caseMilestones.some((m) => !m.approvedByClientAt);
        if (hasUnapproved) {
          throw new BadRequestException(
            'Case cannot transition to IN_PROGRESS until proposed milestones are approved by the client (FR-CASE-04).'
          );
        }
      }

      const updated = await tx.case.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === CaseStatus.CLOSED && { closedAt: new Date() }),
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: id,
          eventType: `CASE_${newStatus}`,
          payload: { caseId: id, status: newStatus, clientId: caseItem.clientId, attorneyId: caseItem.attorneyId },
        },
      });

      return updated;
    });
  }

  // FR-CASE-04: Given an ACCEPTED case, when the attorney proposes milestones...
  async proposeMilestones(caseId: string, data: ProposeMilestonesDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id: caseId },
        include: { caseMilestones: true },
      });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      // Role check: Only the assigned attorney can propose milestones
      if (caseItem.attorneyId !== userId) {
        throw new ForbiddenException('Only the assigned attorney can propose milestones for this case (FR-CASE-04).');
      }

      // Precondition: Case must be in ACCEPTED status (or IN_PROGRESS if adding subsequent milestones)
      if (caseItem.status !== CaseStatus.ACCEPTED && caseItem.status !== CaseStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Cannot propose milestones: Case must be in ACCEPTED status (current status: ${caseItem.status}) (FR-CASE-04).`
        );
      }

      const itemsToCreate: { title: string; description?: string; dueDate?: Date | null }[] = [];
      if (data.milestones && data.milestones.length > 0) {
        for (const m of data.milestones) {
          itemsToCreate.push({
            title: m.title,
            description: m.description || null,
            dueDate: m.dueDate ? new Date(m.dueDate) : null,
          });
        }
      } else if (data.title) {
        itemsToCreate.push({
          title: data.title,
          description: data.description || null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        });
      } else {
        throw new BadRequestException('Milestone title or milestones array is required.');
      }

      const createdMilestones = await Promise.all(
        itemsToCreate.map((item) =>
          tx.caseMilestone.create({
            data: {
              caseId,
              title: item.title,
              description: item.description,
              status: MilestoneStatus.PROPOSED,
              dueDate: item.dueDate,
              proposedBy: userId,
              approvedByClientAt: null,
            },
          })
        )
      );

      await tx.caseTimeline.create({
        data: {
          caseId,
          title: 'Milestones Proposed',
          description: `Attorney proposed ${createdMilestones.length} milestone(s) for client review and approval.`,
          eventDate: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: caseId,
          eventType: 'MILESTONES_PROPOSED',
          payload: {
            caseId,
            attorneyId: caseItem.attorneyId,
            clientId: caseItem.clientId,
            milestones: createdMilestones.map((m) => ({ id: m.id, title: m.title })),
          },
        },
      });

      return createdMilestones.length === 1 && !data.milestones ? createdMilestones[0] : createdMilestones;
    });
  }

  // Alias for backward compatibility
  async createMilestone(caseId: string, data: { title: string; dueDate?: string }, userId: string) {
    return this.proposeMilestones(caseId, data, userId);
  }

  // FR-CASE-04: ...then the client must approve before IN_PROGRESS
  async approveMilestones(caseId: string, data: ApproveMilestonesDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id: caseId },
        include: { caseMilestones: true },
      });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      // Role check: Only the client can approve proposed milestones
      if (caseItem.clientId !== userId) {
        throw new ForbiddenException('Only the client can approve proposed milestones (FR-CASE-04).');
      }

      let targetMilestones = caseItem.caseMilestones.filter((m) => !m.approvedByClientAt);
      if (data?.milestoneIds && data.milestoneIds.length > 0) {
        targetMilestones = targetMilestones.filter((m) => data.milestoneIds!.includes(m.id));
      }

      if (targetMilestones.length === 0) {
        throw new BadRequestException('No pending or unapproved milestones found to approve.');
      }

      const now = new Date();
      const updatedMilestones = await Promise.all(
        targetMilestones.map((m) =>
          tx.caseMilestone.update({
            where: { id: m.id },
            data: {
              status: MilestoneStatus.APPROVED,
              approvedByClientAt: now,
            },
          })
        )
      );

      // Check remaining unapproved milestones
      const remainingUnapproved = await tx.caseMilestone.count({
        where: { caseId, approvedByClientAt: null },
      });

      let currentCaseStatus = caseItem.status;
      // When client approves milestone plan on an ACCEPTED case, move to IN_PROGRESS
      if (caseItem.status === CaseStatus.ACCEPTED && remainingUnapproved === 0) {
        const updatedCase = await tx.case.update({
          where: { id: caseId },
          data: { status: CaseStatus.IN_PROGRESS },
        });
        currentCaseStatus = updatedCase.status;

        await tx.caseTimeline.create({
          data: {
            caseId,
            title: 'Milestone Plan Approved & Case IN_PROGRESS',
            description: 'Client approved the proposed milestones. Case has transitioned to IN_PROGRESS (FR-CASE-04).',
            eventDate: now,
          },
        });

        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Case',
            aggregateId: caseId,
            eventType: 'CASE_IN_PROGRESS',
            payload: { caseId, clientId: caseItem.clientId, attorneyId: caseItem.attorneyId },
          },
        });
      } else {
        await tx.caseTimeline.create({
          data: {
            caseId,
            title: 'Milestones Approved',
            description: `Client approved ${updatedMilestones.length} milestone(s).`,
            eventDate: now,
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: caseId,
          eventType: 'MILESTONES_APPROVED',
          payload: {
            caseId,
            clientId: caseItem.clientId,
            attorneyId: caseItem.attorneyId,
            approvedMilestoneIds: updatedMilestones.map((m) => m.id),
          },
        },
      });

      return {
        message: 'Milestones approved successfully',
        caseStatus: currentCaseStatus,
        milestones: updatedMilestones,
      };
    });
  }

  // FR-CASE-04: ...milestone completion requires client acknowledgement
  async completeMilestone(caseId: string, milestoneId: string, userId: string, deliverableNotes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({ where: { id: caseId } });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      const milestone = await tx.caseMilestone.findFirst({
        where: { id: milestoneId, caseId },
      });
      if (!milestone) throw new NotFoundException(`Milestone ${milestoneId} for Case ${caseId} not found`);

      if (caseItem.attorneyId !== userId) {
        throw new ForbiddenException('Only the assigned attorney can submit milestone completion.');
      }

      if (!milestone.approvedByClientAt) {
        throw new BadRequestException('Cannot complete milestone that has not been approved by the client.');
      }

      const now = new Date();
      // Moves to PENDING_CLIENT_APPROVAL awaiting client acknowledgement
      const updated = await tx.caseMilestone.update({
        where: { id: milestoneId },
        data: {
          status: MilestoneStatus.PENDING_CLIENT_APPROVAL,
          completedAt: now,
          ...(deliverableNotes && {
            description: milestone.description
              ? `${milestone.description}\n[Deliverable]: ${deliverableNotes}`
              : `[Deliverable]: ${deliverableNotes}`,
          }),
        },
      });

      await tx.caseTimeline.create({
        data: {
          caseId,
          title: 'Milestone Deliverable Submitted',
          description: `Attorney marked milestone "${milestone.title}" as completed. Awaiting client acknowledgement (FR-CASE-04).`,
          eventDate: now,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: caseId,
          eventType: 'MILESTONE_COMPLETION_REQUESTED',
          payload: {
            caseId,
            milestoneId,
            title: milestone.title,
            clientId: caseItem.clientId,
            attorneyId: caseItem.attorneyId,
          },
        },
      });

      return {
        message: 'Milestone completion submitted. Awaiting client acknowledgement (FR-CASE-04).',
        milestone: updated,
      };
    });
  }

  // FR-CASE-04: Client acknowledges milestone completion
  async acknowledgeMilestone(caseId: string, milestoneId: string, userId: string, data?: AcknowledgeMilestoneDto) {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({ where: { id: caseId } });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      const milestone = await tx.caseMilestone.findFirst({
        where: { id: milestoneId, caseId },
      });
      if (!milestone) throw new NotFoundException(`Milestone ${milestoneId} for Case ${caseId} not found`);

      // Role check: Only the client can acknowledge milestone completion
      if (caseItem.clientId !== userId) {
        throw new ForbiddenException('Only the client can acknowledge milestone completion (FR-CASE-04).');
      }

      if (
        milestone.status !== MilestoneStatus.PENDING_CLIENT_APPROVAL &&
        milestone.status !== MilestoneStatus.COMPLETED
      ) {
        throw new BadRequestException(
          `Milestone is not awaiting acknowledgement (current status: ${milestone.status}).`
        );
      }

      const now = new Date();
      const updated = await tx.caseMilestone.update({
        where: { id: milestoneId },
        data: {
          status: MilestoneStatus.COMPLETED,
          acknowledgedByClientAt: now,
        },
      });

      await tx.caseTimeline.create({
        data: {
          caseId,
          title: 'Milestone Completion Acknowledged',
          description: `Client acknowledged completion of milestone "${milestone.title}".${data?.feedback ? ` Feedback: "${data.feedback}"` : ''}`,
          eventDate: now,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: caseId,
          eventType: 'MILESTONE_ACKNOWLEDGED',
          payload: {
            caseId,
            milestoneId,
            title: milestone.title,
            clientId: caseItem.clientId,
            attorneyId: caseItem.attorneyId,
            acknowledgedAt: now,
            feedback: data?.feedback,
            rating: data?.rating,
          },
        },
      });

      return {
        message: 'Milestone completion acknowledged successfully',
        milestone: updated,
      };
    });
  }

  async updateMilestoneStatus(caseId: string, milestoneId: string, status: any, userId: string) {
    const caseItem = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    const milestone = await this.prisma.caseMilestone.findFirst({
      where: { id: milestoneId, caseId },
    });
    if (!milestone) throw new NotFoundException(`Milestone ${milestoneId} for Case ${caseId} not found`);

    if (status === 'COMPLETED' || status === MilestoneStatus.COMPLETED) {
      if (caseItem.attorneyId === userId) {
        return this.completeMilestone(caseId, milestoneId, userId);
      } else if (caseItem.clientId === userId) {
        return this.acknowledgeMilestone(caseId, milestoneId, userId);
      }
    }

    return this.prisma.caseMilestone.update({
      where: { id: milestoneId },
      data: {
        status,
        ...(status === MilestoneStatus.COMPLETED && {
          completedAt: milestone.completedAt || new Date(),
          acknowledgedByClientAt: new Date(),
        }),
      },
    });
  }

  async addTimelineEvent(caseId: string, data: { title: string; description?: string; eventDate?: string }, userId: string) {
    const caseItem = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    return this.prisma.caseTimeline.create({
      data: {
        caseId,
        title: data.title,
        description: data.description || null,
        eventDate: data.eventDate ? new Date(data.eventDate) : new Date(),
      },
    });
  }

  async getCaseTimeline(caseId: string) {
    return this.prisma.caseTimeline.findMany({
      where: { caseId },
      orderBy: { eventDate: 'desc' },
    });
  }

  async getCaseAgreement(caseId: string, userId: string) {
    return this.agreementService.getCaseAgreement(caseId, userId);
  }

  async signCaseAgreement(caseId: string, data: SignAgreementDto, userId: string, ipAddress: string = '127.0.0.1') {
    return this.agreementService.signCaseAgreement(caseId, data, userId, ipAddress);
  }

  async declineCaseAgreement(caseId: string, data: DeclineAgreementDto, userId: string) {
    return this.agreementService.declineCaseAgreement(caseId, data, userId);
  }

  async getOrCreateCaseChat(caseId: string, userId?: string) {
    return this.agreementService.getOrCreateCaseChat(caseId, userId);
  }

  // Conflict of Interest Gate & Case Acceptance Decision (FR-CASE-02 / BR-CASE-01 / TC-CASE-01)
  async recordCaseDecision(
    caseId: string,
    decision: 'ACCEPT' | 'DECLINE',
    coiDeclaration: { answers?: Record<string, any>; hasConflict?: boolean; declineReason?: string },
    attorneyId: string
  ) {
    return this.prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({ where: { id: caseId } });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      if (caseItem.attorneyId !== attorneyId) {
        throw new ForbiddenException('Only the assigned attorney can record an acceptance decision on this case.');
      }

      if (decision === 'DECLINE') {
        const updated = await tx.case.update({
          where: { id: caseId },
          data: {
            status: CaseStatus.CLOSED,
            closedAt: new Date(),
          },
        });
        await tx.caseTimeline.create({
          data: {
            caseId,
            title: 'Case Declined',
            description: `Attorney declined representation. Reason: ${coiDeclaration?.declineReason || 'Not specified'}.`,
            eventDate: new Date(),
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Case',
            aggregateId: caseId,
            eventType: 'CASE_DECLINED',
            payload: { caseId, attorneyId, reason: coiDeclaration?.declineReason || 'Declined by attorney' },
          },
        });
        return { status: 'DECLINED', message: 'Case declined successfully', case: updated };
      }

      // Conflict of Interest Check (BR-CASE-01): Blocks acceptance on declared conflict
      if (coiDeclaration?.hasConflict) {
        throw new BadRequestException({
          code: 'CONFLICT_OF_INTEREST_DECLARED',
          message: 'Acceptance blocked: Attorney indicated a Conflict of Interest. Client will be offered re-matching.',
        });
      }

      // Transition to ACCEPTED (FR-CASE-02 / FR-CASE-04)
      const updated = await tx.case.update({
        where: { id: caseId },
        data: {
          status: CaseStatus.ACCEPTED,
          conflictAcknowledged: true,
        },
      });

      await tx.caseTimeline.create({
        data: {
          caseId,
          title: 'Case Accepted (Awaiting Milestone Plan)',
          description:
            'Attorney completed conflict-of-interest check and accepted the case. Next step: attorney proposes milestones for client approval before IN_PROGRESS (FR-CASE-04).',
          eventDate: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Case',
          aggregateId: caseId,
          eventType: 'CASE_ACCEPTED',
          payload: { caseId, attorneyId, clientId: caseItem.clientId },
        },
      });

      return { status: 'ACCEPTED', message: 'Case accepted successfully', case: updated };
    });
  }
}


