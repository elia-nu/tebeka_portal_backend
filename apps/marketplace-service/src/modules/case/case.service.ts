import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Optional } from '@nestjs/common';
import { PrismaClient, CaseStatus, Priority, AgreementStatus, AgreementType } from '@prisma/client/marketplace';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';
import { SignAgreementDto, DeclineAgreementDto } from './dto/agreement.dto';

const prisma = new PrismaClient();

export const DEFAULT_AGREEMENT_TERMS = `
# Tebeka Legal Portal — Tri-Party Engagement & Non-Circumvention Agreement
Version: 1.0 | Applicable to: Client, Attorney, Tebeka Platform

## 1. Scope & Tri-Party Commitment
This Agreement is entered into between the Client, the Assigned Attorney, and the Tebeka Legal Portal Platform ("Tebeka"). By signing below, all parties agree to adhere strictly to the terms of engagement, fee protections, and ethical legal conduct.

## 2. Non-Circumvention & Off-Platform Communication Ban
- Both Client and Attorney strictly agree not to solicit, communicate, or facilitate legal consultations, document exchange, or case management outside of the Tebeka Portal.
- Sharing private contact details (phone numbers, WhatsApp, external email, Telegram) for the purpose of circumventing platform fees or escrow is strictly prohibited.
- Violation of this clause constitutes a material breach resulting in immediate suspension, account termination, and forfeiture of platform escrow dispute rights.

## 3. Escrow Payment & Milestone Billing Binding
- All fees, retaining costs, and milestone payments associated with this legal matter must be processed exclusively through the Tebeka Escrow system.
- The platform retains a 15% service commission, and 85% is held safely in escrow and disbursed to the attorney upon confirmed delivery of agreed milestones.
- Off-platform cash or direct bank transfers are void of all platform guarantees, refund eligibility, and malpractice protections.

## 4. Professional Conduct, Exclusivity & Confidentiality
- Attorney affirms no conflict of interest with the opposing party and agrees to uphold the highest standard of Ethiopian legal ethics.
- All documents, case strategy notes, and communications exchanged within the Tebeka workspace are confidential and protected by attorney-client privilege.
`;

@Injectable()
export class CaseService {
  constructor(
    @Optional() private readonly communicationServiceClient?: CommunicationServiceClient
  ) {}

  async createCase(data: any, clientId: string) {
    if (!data.title) throw new BadRequestException('Case title is required');
    if (!data.description) throw new BadRequestException('Case description is required');
    if (!data.attorneyId) throw new BadRequestException('attorneyId is required');

    // Interactive Transaction: Validate booking, create case, milestones, agreement, link booking, persist OutboxEvent inside tx
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
          agreement: {
            create: {
              agreementType: AgreementType.CASE_ENGAGEMENT_NON_CIRCUMVENTION,
              version: 1,
              termsContent: DEFAULT_AGREEMENT_TERMS,
              status: AgreementStatus.PENDING_SIGNATURES,
            },
          },
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

  async getCaseAgreement(caseId: string, userId: string) {
    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      include: { agreement: true },
    });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    let agreement = caseItem.agreement;
    if (!agreement) {
      agreement = await prisma.caseAgreement.create({
        data: {
          caseId,
          termsContent: DEFAULT_AGREEMENT_TERMS,
          status: AgreementStatus.PENDING_SIGNATURES,
        },
      });
    }

    const isClient = caseItem.clientId === userId;
    const isAttorney = caseItem.attorneyId === userId;
    const userRole = isClient ? 'CLIENT' : isAttorney ? 'ATTORNEY' : 'OBSERVER';

    return {
      ...agreement,
      caseId: caseItem.id,
      caseReference: caseItem.referenceNumber,
      caseTitle: caseItem.title,
      clientId: caseItem.clientId,
      attorneyId: caseItem.attorneyId,
      currentUserRole: userRole,
      canSign: (isClient && !agreement.clientSigned) || (isAttorney && !agreement.attorneySigned),
      isFullyExecuted: agreement.status === AgreementStatus.FULLY_EXECUTED,
      chatRoomUnlocked: agreement.status === AgreementStatus.FULLY_EXECUTED,
    };
  }

  async signCaseAgreement(caseId: string, data: SignAgreementDto, userId: string, ipAddress: string = '127.0.0.1') {
    return prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id: caseId },
        include: { agreement: true },
      });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      let agreement = caseItem.agreement;
      if (!agreement) {
        agreement = await tx.caseAgreement.create({
          data: {
            caseId,
            termsContent: DEFAULT_AGREEMENT_TERMS,
            status: AgreementStatus.PENDING_SIGNATURES,
          },
        });
      }

      if (agreement.status === AgreementStatus.FULLY_EXECUTED) {
        return {
          ...agreement,
          message: 'Agreement has already been fully executed by both parties.',
          chatRoomUnlocked: true,
        };
      }

      const isClient = caseItem.clientId === userId;
      const isAttorney = caseItem.attorneyId === userId;

      if (!isClient && !isAttorney) {
        throw new ForbiddenException('Only the assigned client or attorney can sign this agreement.');
      }

      const updateData: any = {};
      const now = new Date();

      if (isClient) {
        if (agreement.clientSigned) {
          throw new BadRequestException('Client has already signed this agreement.');
        }
        updateData.clientSigned = true;
        updateData.clientSignedAt = now;
        updateData.clientSignerIp = ipAddress;
        updateData.clientSignerName = data.signerName;
        updateData.nonCircumventionAck = true;
        updateData.platformFeeAck = true;
        updateData.confidentialityAck = true;
      }

      if (isAttorney) {
        if (agreement.attorneySigned) {
          throw new BadRequestException('Attorney has already signed this agreement.');
        }
        updateData.attorneySigned = true;
        updateData.attorneySignedAt = now;
        updateData.attorneySignerIp = ipAddress;
        updateData.attorneySignerName = data.signerName;
        updateData.nonCircumventionAck = true;
        updateData.platformFeeAck = true;
        updateData.confidentialityAck = true;
      }

      const willBeFullyExecuted =
        (isClient && agreement.attorneySigned) ||
        (isAttorney && agreement.clientSigned);

      if (willBeFullyExecuted) {
        updateData.status = AgreementStatus.FULLY_EXECUTED;
        updateData.fullyExecutedAt = now;
      }

      const updatedAgreement = await tx.caseAgreement.update({
        where: { id: agreement.id },
        data: updateData,
      });

      // If fully executed, log timeline and dispatch outbox event
      if (willBeFullyExecuted) {
        await tx.caseTimeline.create({
          data: {
            caseId,
            title: 'Tri-Party Non-Circumvention Agreement Executed',
            description: `Agreement signed by Client (${updatedAgreement.clientSignerName || data.signerName}) and Attorney (${updatedAgreement.attorneySignerName || data.signerName}). Workspace and communication unlocked.`,
            eventDate: now,
          },
        });

        await tx.outboxEvent.create({
          data: {
            aggregateType: 'CaseAgreement',
            aggregateId: agreement.id,
            eventType: 'AGREEMENT_EXECUTED',
            payload: {
              caseId,
              agreementId: agreement.id,
              clientId: caseItem.clientId,
              attorneyId: caseItem.attorneyId,
              executedAt: now,
            },
          },
        });
      }

      return {
        ...updatedAgreement,
        chatRoomUnlocked: willBeFullyExecuted,
        message: willBeFullyExecuted
          ? 'Agreement fully executed! Direct communication and case workspace unlocked.'
          : `Agreement signed successfully. Waiting for ${isClient ? 'Attorney' : 'Client'} signature.`,
      };
    });
  }

  async declineCaseAgreement(caseId: string, data: DeclineAgreementDto, userId: string) {
    return prisma.$transaction(async (tx) => {
      const caseItem = await tx.case.findUnique({
        where: { id: caseId },
        include: { agreement: true },
      });
      if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

      const isClient = caseItem.clientId === userId;
      const isAttorney = caseItem.attorneyId === userId;
      if (!isClient && !isAttorney) {
        throw new ForbiddenException('Only the assigned client or attorney can decline this agreement.');
      }

      let agreement = caseItem.agreement;
      if (!agreement) {
        agreement = await tx.caseAgreement.create({
          data: {
            caseId,
            termsContent: DEFAULT_AGREEMENT_TERMS,
            status: AgreementStatus.PENDING_SIGNATURES,
          },
        });
      }

      const updatedAgreement = await tx.caseAgreement.update({
        where: { id: agreement.id },
        data: {
          status: AgreementStatus.DECLINED,
          declinedBy: userId,
          declineReason: data.reason,
        },
      });

      await tx.case.update({
        where: { id: caseId },
        data: { status: CaseStatus.CANCELLED },
      });

      await tx.caseTimeline.create({
        data: {
          caseId,
          title: 'Engagement Agreement Declined',
          description: `Agreement terms were declined by ${isClient ? 'Client' : 'Attorney'}. Reason: ${data.reason}`,
          eventDate: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'CaseAgreement',
          aggregateId: updatedAgreement.id,
          eventType: 'AGREEMENT_DECLINED',
          payload: {
            caseId,
            agreementId: updatedAgreement.id,
            declinedBy: userId,
            reason: data.reason,
          },
        },
      });

      return {
        ...updatedAgreement,
        message: 'Agreement declined. Case engagement cancelled.',
      };
    });
  }

  async getOrCreateCaseChat(caseId: string, userId?: string) {
    const caseItem = await prisma.case.findUnique({
      where: { id: caseId },
      include: { agreement: true },
    });
    if (!caseItem) throw new NotFoundException(`Legal Case ${caseId} not found`);

    const isAgreementExecuted = caseItem.agreement?.status === AgreementStatus.FULLY_EXECUTED;

    let chatResult: any = null;
    if (this.communicationServiceClient) {
      chatResult = await this.communicationServiceClient.getOrCreateCaseChat(
        caseItem.id,
        caseItem.clientId,
        caseItem.attorneyId,
        `Case: ${caseItem.title || caseItem.referenceNumber || caseItem.id}`
      );
    } else {
      chatResult = {
        status: 'pending',
        caseId: caseItem.id,
        clientId: caseItem.clientId,
        attorneyId: caseItem.attorneyId,
        message: 'Chat conversation created/linked with legal case',
      };
    }

    return {
      ...chatResult,
      isAgreementExecuted,
      agreementStatus: caseItem.agreement?.status || AgreementStatus.PENDING_SIGNATURES,
      chatRoomUnlocked: isAgreementExecuted,
      notice: isAgreementExecuted
        ? 'Communication room is open and active.'
        : 'Agreement pending execution. Both client and attorney must sign the Non-Circumvention Agreement to unlock direct messaging.',
    };
  }
}
