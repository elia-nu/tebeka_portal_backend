import { Injectable } from '@nestjs/common';
import { PrismaService } from '@workspace/database';
import { VerificationCaseService } from './verification-case.service';

@Injectable()
export class VerificationFraudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationCaseService: VerificationCaseService,
  ) {}

  async updateBarStandingCheck(attorneyId: string, data: { status: string; checkedBy: string; notes?: string }) {
    return this.prisma.attorneyProfile.update({
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
    await this.prisma.verificationCase.update({
      where: { id },
      data: { fraudStatus: 'FRAUD_REVIEW' }
    });

    return this.prisma.fraudReviewCase.create({
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
    const fraudCase = await this.prisma.fraudReviewCase.findFirst({
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
