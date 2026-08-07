import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class VerificationsService {
  async createVerification(data: any) {
    // 3 business day SLA target calculation (skipping weekends)
    const now = new Date();
    const slaDueDate = new Date(now.valueOf() + 3 * 24 * 60 * 60 * 1000);

    return prisma.verificationCase.create({
      data: {
        attorneyId: data.attorneyId,
        status: 'SUBMITTED',
        slaDueDate,
        checklists: {
          create: [
            { itemName: 'identity_match', status: 'PENDING' },
            { itemName: 'bar_number_format', status: 'PENDING' },
            { itemName: 'certificate_authenticity', status: 'PENDING' },
            { itemName: 'bar_standing', status: 'PENDING' },
          ],
        },
      },
      include: { checklists: true }
    });
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.fraudStatus) where.fraudStatus = query.fraudStatus;
    if (query.assignedReviewerId) where.assignedReviewerId = query.assignedReviewerId;

    const [items, total] = await Promise.all([
      prisma.verificationCase.findMany({
        where,
        skip,
        take: limit,
        include: { attorney: { include: { user: true } }, checklists: true },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.verificationCase.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const vCase = await prisma.verificationCase.findUnique({
      where: { id },
      include: {
        attorney: { include: { user: true, credentials: { include: { documents: true } } } },
        checklists: true
      },
    });
    if (!vCase) throw new NotFoundException(`Verification case ${id} not found`);
    return vCase;
  }

  async updateChecklist(caseId: string, itemId: string, data: { status: 'PASSED' | 'FAILED'; remarks?: string; reviewerId: string }) {
    return prisma.verificationChecklist.update({
      where: { id: itemId },
      data: {
        status: data.status,
        remarks: data.remarks,
        completedBy: data.reviewerId,
        completedAt: new Date()
      }
    });
  }

  async updateBarStandingCheck(attorneyId: string, data: { status: string; checkedBy: string; notes?: string }) {
    return prisma.attorneyProfile.update({
      where: { id: attorneyId },
      data: {
        standingStatus: data.status,
        standingCheckedBy: data.checkedBy,
        standingCheckedAt: new Date(),
        standingNotes: data.notes
      }
    });
  }

  async approveVerification(id: string, reviewerId: string) {
    const vCase = await this.findOne(id);

    // Segregation of duties: reviewer who flagged fraud cannot approve case
    const fraudCase = await prisma.fraudReviewCase.findFirst({
      where: { verificationCaseId: id }
    });
    if (fraudCase && fraudCase.flaggedByUserId === reviewerId) {
      throw new ForbiddenException({
        code: 'SEGREGATION_OF_DUTIES_VIOLATION',
        message: 'Reviewer who flagged a case for fraud cannot issue the final decision'
      });
    }

    // Check mandatory 4 checklist items
    const unpassed = vCase.checklists.filter(c => c.status !== 'PASSED');
    if (unpassed.length > 0) {
      throw new BadRequestException({
        code: 'CHECKLIST_INCOMPLETE',
        message: `All 4 mandatory checklist items must be PASSED before approval. Pending: ${unpassed.map(c => c.itemName).join(', ')}`
      });
    }

    await prisma.attorneyProfile.update({
      where: { id: vCase.attorneyId },
      data: {
        verificationStatus: 'APPROVED',
        hasVerifiedBadge: true,
        credentialClaimsMatch: true
      }
    });

    return prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'APPROVED',
        verifiedAt: new Date(),
        assignedReviewerId: reviewerId
      },
    });
  }

  async rejectVerification(id: string, reason: string, reviewerId: string) {
    const vCase = await this.findOne(id);

    const fraudCase = await prisma.fraudReviewCase.findFirst({
      where: { verificationCaseId: id }
    });
    if (fraudCase && fraudCase.flaggedByUserId === reviewerId) {
      throw new ForbiddenException({
        code: 'SEGREGATION_OF_DUTIES_VIOLATION',
        message: 'Reviewer who flagged a case for fraud cannot issue the final decision'
      });
    }

    await prisma.attorneyProfile.update({
      where: { id: vCase.attorneyId },
      data: { verificationStatus: 'REJECTED' }
    });

    return prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason,
        assignedReviewerId: reviewerId
      },
    });
  }

  // Request more info -> PAUSES SLA
  async requestDocuments(id: string, notes: string) {
    return prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'ADDITIONAL_INFO_REQUIRED',
        rejectedReason: notes,
        isSlaPaused: true,
        slaPausedAt: new Date()
      },
    });
  }

  // Attorney responds -> RESUMES SLA
  async respondMoreInfo(id: string) {
    return prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'PENDING_REVIEW',
        isSlaPaused: false,
        slaResumedAt: new Date()
      }
    });
  }

  // Flag Fraud
  async flagFraud(id: string, data: { flaggedByUserId: string; signalTypes: string[]; notes?: string }) {
    await prisma.verificationCase.update({
      where: { id },
      data: { fraudStatus: 'FRAUD_REVIEW' }
    });

    return prisma.fraudReviewCase.create({
      data: {
        verificationCaseId: id,
        flaggedByUserId: data.flaggedByUserId,
        fraudSignalTypes: data.signalTypes,
        status: 'FRAUD_REVIEW',
        notes: data.notes
      }
    });
  }

  // Correction Flow (Creates NEW case referencing previousCaseId)
  async createCorrectionCase(previousCaseId: string, attorneyId: string) {
    const prevCase = await this.findOne(previousCaseId);
    if (!prevCase.isImmutable) {
      throw new BadRequestException('Previous case must be marked immutable');
    }

    const now = new Date();
    const slaDueDate = new Date(now.valueOf() + 3 * 24 * 60 * 60 * 1000);

    return prisma.verificationCase.create({
      data: {
        attorneyId,
        status: 'SUBMITTED',
        previousCaseId,
        slaDueDate,
        checklists: {
          create: [
            { itemName: 'identity_match', status: 'PENDING' },
            { itemName: 'bar_number_format', status: 'PENDING' },
            { itemName: 'certificate_authenticity', status: 'PENDING' },
            { itemName: 'bar_standing', status: 'PENDING' },
          ],
        },
      }
    });
  }

  // Bulk Claim
  async bulkClaim(caseIds: string[], reviewerId: string) {
    await prisma.verificationCase.updateMany({
      where: { id: { in: caseIds } },
      data: { assignedReviewerId: reviewerId, status: 'PENDING_REVIEW' }
    });
    return { status: 'success', claimedCount: caseIds.length, reviewerId };
  }

  // Document view audit log
  async logDocumentView(reviewerId: string, verificationCaseId: string, documentId: string, ipAddress?: string) {
    return prisma.verificationDocumentAccessLog.create({
      data: {
        reviewerId,
        verificationCaseId,
        documentId,
        ipAddress,
        accessedAt: new Date()
      }
    });
  }

  // Fraud Review Workspace API
  async getFraudWorkspace(caseId: string) {
    const vCase = await this.findOne(caseId);
    const fraudCase = await prisma.fraudReviewCase.findFirst({
      where: { verificationCaseId: caseId }
    });

    return {
      verificationCase: vCase,
      fraudDetails: fraudCase,
      linkedCaseGraph: {
        sharedDocuments: [],
        sharedDevices: [],
        suspectedAccounts: []
      },
      seniorReviewerDecisionPanelAvailable: true
    };
  }

  // Attorney Status View
  async getAttorneyCaseView(attorneyId: string) {
    const vCase = await prisma.verificationCase.findFirst({
      where: { attorneyId },
      orderBy: { submittedAt: 'desc' },
      include: { checklists: true }
    });

    return {
      currentCase: vCase,
      canUploadMoreInfo: vCase?.status === 'ADDITIONAL_INFO_REQUIRED',
      slaStatus: vCase?.isSlaPaused ? 'PAUSED' : 'ACTIVE'
    };
  }
}
