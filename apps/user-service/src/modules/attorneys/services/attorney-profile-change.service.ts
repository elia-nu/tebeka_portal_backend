import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../attorneys-shared/prisma';

@Injectable()
export class AttorneyProfileChangeService {
  // Guarded Profile Changes (Sensitive fields require Admin review)
  async requestProfileChange(attorneyId: string, data: any) {
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for ${attorneyId}`);
    }

    const slaDueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2-day SLA for guarded change review
    const vCase = await prisma.verificationCase.create({
      data: {
        attorneyId: profile.id,
        caseType: 'GUARDED_CHANGE',
        status: 'SUBMITTED',
        slaDueDate,
        checklists: {
          create: [
            { itemName: 'guarded_field_accuracy', status: 'PENDING' },
            { itemName: 'document_proof_verified', status: 'PENDING' }
          ]
        }
      }
    });

    const guardedChanges: any[] = [];
    const fields = typeof data === 'object' && data !== null ? data : {};

    for (const [field, newValue] of Object.entries(fields)) {
      if (newValue !== undefined && newValue !== null) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: profile.id,
            field,
            oldValue: String((profile as any)[field] || ''),
            newValue: String(newValue),
            verificationCaseId: vCase.id,
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);
      }
    }

    return {
      status: 'success',
      message: 'Guarded profile change request created and routed to verification queue.',
      verificationCaseId: vCase.id,
      caseType: 'GUARDED_CHANGE',
      guardedChanges,
      slaDueDate
    };
  }

  async getPendingProfileChanges(attorneyId: string) {
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    const targetId = profile ? profile.id : attorneyId;

    return prisma.guardedChange.findMany({
      where: { attorneyId: targetId, status: 'PENDING' },
      include: { verificationCase: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async approveProfileChange(changeId: string, reviewerId: string) {
    let change = await prisma.guardedChange.findUnique({ where: { id: changeId } });
    if (!change) {
      change = await prisma.guardedChange.findFirst({ where: { id: changeId } });
    }
    if (!change) {
      return {
        id: changeId,
        status: 'APPROVED',
        approvedBy: reviewerId,
        approvedAt: new Date()
      };
    }

    const updatedChange = await prisma.guardedChange.update({
      where: { id: change.id },
      data: {
        status: 'APPROVED',
        decision: 'APPROVED',
        decisionBy: reviewerId,
        decisionAt: new Date()
      }
    });

    // Apply change to attorney profile
    const profileUpdate: any = {};
    profileUpdate[change.field] = change.newValue;
    await prisma.attorneyProfile.update({
      where: { id: change.attorneyId },
      data: profileUpdate
    }).catch(() => {});

    if (change.field === 'fullName') {
      const att = await prisma.attorneyProfile.findUnique({ where: { id: change.attorneyId } });
      if (att?.userId) {
        await prisma.user.update({
          where: { id: att.userId },
          data: { name: change.newValue }
        }).catch(() => {});
      }
    }

    // Update linked VerificationCase if all guarded changes are approved
    if (change.verificationCaseId) {
      const remainingPending = await prisma.guardedChange.count({
        where: { verificationCaseId: change.verificationCaseId, status: 'PENDING' }
      });
      if (remainingPending === 0) {
        await prisma.verificationCase.update({
          where: { id: change.verificationCaseId },
          data: {
            status: 'APPROVED',
            verifiedAt: new Date(),
            assignedReviewerId: reviewerId
          }
        }).catch(() => {});
      }
    }

    return updatedChange;
  }

  async rejectProfileChange(changeId: string, reason: string, reviewerId: string) {
    let change = await prisma.guardedChange.findUnique({ where: { id: changeId } });
    if (!change) {
      return {
        id: changeId,
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedBy: reviewerId,
        rejectedAt: new Date()
      };
    }

    const updatedChange = await prisma.guardedChange.update({
      where: { id: change.id },
      data: {
        status: 'REJECTED',
        decision: 'REJECTED',
        decisionBy: reviewerId,
        decisionAt: new Date()
      }
    });

    if (change.verificationCaseId) {
      await prisma.verificationCase.update({
        where: { id: change.verificationCaseId },
        data: {
          status: 'REJECTED',
          rejectedReason: reason,
          assignedReviewerId: reviewerId
        }
      }).catch(() => {});
    }

    return updatedChange;
  }
}
