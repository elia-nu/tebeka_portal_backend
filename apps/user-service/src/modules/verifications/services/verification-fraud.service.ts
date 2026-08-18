import { Injectable } from '@nestjs/common';
import { prisma } from '../verifications-shared/prisma';
import { VerificationCaseService } from './verification-case.service';

@Injectable()
export class VerificationFraudService {
  constructor(private readonly verificationCaseService: VerificationCaseService) {}

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

  // Fraud Review Workspace API
  async getFraudWorkspace(caseId: string) {
    const vCase = await this.verificationCaseService.findOne(caseId);
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
}
