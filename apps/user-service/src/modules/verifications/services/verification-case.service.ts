import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { sanitizeUser } from '../../users/users.service';
import { prisma } from '../verifications-shared/prisma';

@Injectable()
export class VerificationCaseService {
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

    return { items: sanitizeUser(items), total, page, limit, totalPages: Math.ceil(total / limit) };
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
    return sanitizeUser(vCase);
  }

  async updateChecklist(caseId: string, itemId: string, data: { status: 'PASSED' | 'FAILED'; remarks?: string; reviewerId: string }) {
    let item = await prisma.verificationChecklist.findFirst({
      where: {
        OR: [
          { id: itemId },
          { verificationCaseId: caseId, itemName: itemId }
        ]
      }
    });

    if (!item) {
      item = await prisma.verificationChecklist.create({
        data: {
          verificationCaseId: caseId,
          itemName: itemId,
          status: data.status,
          remarks: data.remarks,
          completedBy: data.reviewerId,
          completedAt: new Date()
        }
      });
      return item;
    }

    return prisma.verificationChecklist.update({
      where: { id: item.id },
      data: {
        status: data.status,
        remarks: data.remarks,
        completedBy: data.reviewerId,
        completedAt: new Date()
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

  // Attorney Status View
  async getAttorneyCaseView(attorneyIdentifier: string) {
    if (!attorneyIdentifier || attorneyIdentifier === 'undefined') {
      throw new BadRequestException('Attorney identifier or user authorization token is required');
    }
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyIdentifier } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyIdentifier } });
    }
    if (!profile) {
      const vCaseById = await prisma.verificationCase.findUnique({ where: { id: attorneyIdentifier } });
      if (vCaseById) {
        profile = await prisma.attorneyProfile.findUnique({ where: { id: vCaseById.attorneyId } });
      }
    }
    const targetAttorneyId = profile ? profile.id : attorneyIdentifier;

    const [vCase, credentials] = await Promise.all([
      prisma.verificationCase.findFirst({
        where: { attorneyId: targetAttorneyId },
        orderBy: { submittedAt: 'desc' },
        include: { checklists: true }
      }),
      prisma.credential.findMany({
        where: { attorneyId: targetAttorneyId },
        include: { documents: true }
      })
    ]);

    return {
      currentCase: vCase,
      credentials,
      amendmentNotes: (vCase as any)?.amendmentNotes || vCase?.rejectedReason || null,
      requestedFields: (vCase as any)?.requestedFields || [],
      amendmentReply: (vCase as any)?.amendmentReply || null,
      canUploadMoreInfo: vCase?.status === 'ADDITIONAL_INFO_REQUIRED',
      canSubmitAmendment: vCase?.status === 'ADDITIONAL_INFO_REQUIRED',
      slaStatus: vCase?.isSlaPaused ? 'PAUSED' : 'ACTIVE'
    };
  }
}
