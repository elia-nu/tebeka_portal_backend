import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaClient, CaseStatus, Priority } from '@prisma/client/marketplace';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';

const prisma = new PrismaClient();

@Injectable()
export class CaseService {
  constructor(
    @Optional() private readonly communicationServiceClient?: CommunicationServiceClient
  ) {}

  async createCase(data: any, clientId: string) {
    if (!data.title) throw new BadRequestException('Case title is required');
    if (!data.description) throw new BadRequestException('Case description is required');
    if (!data.attorneyId) throw new BadRequestException('attorneyId is required');

    // Interactive Transaction: Validate booking, create case & milestones, link booking, persist OutboxEvent inside tx
    return prisma.$transaction(async (tx) => {
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
          caseMilestones: {
            create: [
              { title: 'Case Opened & Consultation Conducted' },
              { title: 'Initial Document Review' },
              { title: 'Legal Strategy Formulation' },
            ],
          },
          caseTimelines: {
            create: [
              {
                title: 'Case Initialized',
                description: `Case registered with reference ${referenceNumber}`,
                eventDate: new Date(),
              },
            ],
          },
        },
        include: { caseDocuments: true, caseMilestones: true, caseTimelines: true },
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
      prisma.case.findMany({
        where,
        skip,
        take: limit,
        include: { caseDocuments: true, caseMilestones: true },
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.case.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const caseItem = await prisma.case.findUnique({
      where: { id },
      include: { caseDocuments: true, caseMilestones: true, booking: true },
    });
    if (!caseItem) throw new NotFoundException(`Legal Case ${id} not found`);
    return caseItem;
  }

  async updateCaseStatus(id: string, newStatus: CaseStatus, userId: string) {
    return prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id },
      });

      if (!caseItem) {
        throw new NotFoundException(`Legal Case ${id} not found`);
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

  async createMilestone(caseId: string, data: { title: string; dueDate?: string }, userId: string) {
    const caseItem = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    return prisma.caseMilestone.create({
      data: {
        caseId,
        title: data.title,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });
  }

  async updateMilestoneStatus(caseId: string, milestoneId: string, status: any, userId: string) {
    const milestone = await prisma.caseMilestone.findFirst({
      where: { id: milestoneId, caseId },
    });
    if (!milestone) throw new NotFoundException(`Milestone ${milestoneId} for Case ${caseId} not found`);

    return prisma.caseMilestone.update({
      where: { id: milestoneId },
      data: {
        status,
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });
  }

  async addTimelineEvent(caseId: string, data: { title: string; description?: string; eventDate?: string }, userId: string) {
    const caseItem = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    return prisma.caseTimeline.create({
      data: {
        caseId,
        title: data.title,
        description: data.description || null,
        eventDate: data.eventDate ? new Date(data.eventDate) : new Date(),
      },
    });
  }

  async getCaseTimeline(caseId: string) {
    return prisma.caseTimeline.findMany({
      where: { caseId },
      orderBy: { eventDate: 'desc' },
    });
  }

  async getOrCreateCaseChat(caseId: string, userId?: string) {
    const caseItem = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    if (this.communicationServiceClient) {
      return this.communicationServiceClient.getOrCreateCaseChat(
        caseItem.id,
        caseItem.clientId,
        caseItem.attorneyId,
        `Case: ${caseItem.title || caseItem.referenceNumber || caseItem.id}`
      );
    }

    return {
      status: 'pending',
      caseId: caseItem.id,
      clientId: caseItem.clientId,
      attorneyId: caseItem.attorneyId,
      message: 'Chat conversation created/linked with legal case',
    };
  }
}
