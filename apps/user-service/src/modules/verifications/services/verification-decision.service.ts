import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventBusService } from '@workspace/event-bus';
import { prisma } from '../verifications-shared/prisma';
import { VerificationCaseService } from './verification-case.service';

@Injectable()
export class VerificationDecisionService {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly verificationCaseService: VerificationCaseService,
  ) {}

  async approveVerification(id: string, reviewerId: string) {
    const vCase = await this.verificationCaseService.findOne(id);

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

    const updatedCase = await prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'APPROVED',
        verifiedAt: new Date(),
        assignedReviewerId: reviewerId
      },
    });

    await this.eventBus.publish('ATTORNEY_VERIFIED', {
      attorneyId: vCase.attorneyId,
      verifiedAt: updatedCase.verifiedAt,
    });

    return updatedCase;
  }

  async rejectVerification(id: string, reason: string, reviewerId: string) {
    const vCase = await this.verificationCaseService.findOne(id);

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

  // Request Amendment from Attorney (Admin Action)
  async requestAmendment(id: string, data: { notes: string; requestedFields?: string[] }, reviewerId: string) {
    const vCase = await this.verificationCaseService.findOne(id);

    await prisma.attorneyProfile.update({
      where: { id: vCase.attorneyId },
      data: { verificationStatus: 'ADDITIONAL_INFO_REQUIRED' }
    });

    const updatedCase = await prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'ADDITIONAL_INFO_REQUIRED',
        amendmentNotes: data.notes,
        requestedFields: data.requestedFields || [],
        amendmentRequestedAt: new Date(),
        rejectedReason: data.notes,
        isSlaPaused: true,
        slaPausedAt: new Date(),
        assignedReviewerId: reviewerId,
      } as any,
    });

    await this.eventBus.publish('ATTORNEY_AMENDMENT_REQUESTED', {
      attorneyId: vCase.attorneyId,
      verificationCaseId: id,
      notes: data.notes,
      requestedFields: data.requestedFields || [],
      requestedAt: (updatedCase as any).amendmentRequestedAt,
    });

    return updatedCase;
  }

  // Request more info -> PAUSES SLA & Syncs AttorneyProfile status
  async requestDocuments(id: string, notes: string, requestedFields?: string[]) {
    const vCase = await this.verificationCaseService.findOne(id);

    await prisma.attorneyProfile.update({
      where: { id: vCase.attorneyId },
      data: { verificationStatus: 'ADDITIONAL_INFO_REQUIRED' }
    });

    return prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'ADDITIONAL_INFO_REQUIRED',
        amendmentNotes: notes,
        requestedFields: requestedFields || [],
        amendmentRequestedAt: new Date(),
        rejectedReason: notes,
        isSlaPaused: true,
        slaPausedAt: new Date()
      } as any,
    });
  }

  // Attorney responds -> RESUMES SLA & Syncs AttorneyProfile status
  async respondMoreInfo(id: string, replyNotes?: string) {
    const vCase = await this.verificationCaseService.findOne(id);

    await prisma.attorneyProfile.update({
      where: { id: vCase.attorneyId },
      data: { verificationStatus: 'PENDING_REVIEW' }
    });

    const updatedCase = await prisma.verificationCase.update({
      where: { id },
      data: {
        status: 'PENDING_REVIEW',
        amendmentReply: replyNotes || (vCase as any).amendmentReply,
        amendmentSubmittedAt: new Date(),
        isSlaPaused: false,
        slaResumedAt: new Date()
      } as any
    });

    await this.eventBus.publish('ATTORNEY_AMENDMENT_SUBMITTED', {
      attorneyId: vCase.attorneyId,
      verificationCaseId: id,
      amendmentReply: replyNotes,
      submittedAt: (updatedCase as any).amendmentSubmittedAt,
    });

    return updatedCase;
  }
}
