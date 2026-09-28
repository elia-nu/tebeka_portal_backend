import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@workspace/database';
import { VerificationCaseService } from './verification-case.service';
import * as crypto from 'crypto';

@Injectable()
export class VerificationFraudService {
  private readonly logger = new Logger(VerificationFraudService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationCaseService: VerificationCaseService,
  ) {}

  computeSha256(contentOrKey: string): string {
    return crypto.createHash('sha256').update(contentOrKey).digest('hex');
  }

  async updateBarStandingCheck(attorneyId: string, data: { status: string; checkedBy: string; notes?: string }) {
    return this.prisma.attorneyProfile.update({
      where: { id: attorneyId },
      data: {
        standingStatus: data.status,
        standingCheckedBy: data.checkedBy,
        standingCheckedAt: new Date(),
        standingNotes: data.notes,
      },
    });
  }

  // Flag Fraud
  async flagFraud(id: string, data: { flaggedByUserId: string; signalTypes: string[]; notes?: string }) {
    await this.prisma.verificationCase.update({
      where: { id },
      data: { fraudStatus: 'FRAUD_REVIEW' },
    });

    return this.prisma.fraudReviewCase.create({
      data: {
        verificationCaseId: id,
        flaggedByUserId: data.flaggedByUserId,
        fraudSignalTypes: data.signalTypes,
        status: 'FRAUD_REVIEW',
        notes: data.notes,
      },
    });
  }

  /**
   * FR-VERIF-05: Fraud signal flagging for duplicate documents
   * Given a document hash matching another account, when detected, then both cases
   * are flagged FRAUD_REVIEW and blocked from auto-progress.
   */
  async checkAndFlagDuplicateDocument(
    currentAttorneyId: string,
    fileKeyOrUrl: string,
    providedHash?: string,
    flaggedByUserId: string = 'system-fraud-engine',
  ) {
    if (!fileKeyOrUrl || String(fileKeyOrUrl).trim() === '') {
      return { isDuplicate: false };
    }

    const cleanKey = String(fileKeyOrUrl).trim();
    const sha256 = providedHash || this.computeSha256(cleanKey);

    // 1. Check if another attorney shares the exact file key or duplicate document
    const duplicateDoc = await this.prisma.credentialDocument.findFirst({
      where: {
        fileKey: cleanKey,
        credential: {
          attorneyId: { not: currentAttorneyId },
        },
      },
      include: {
        credential: {
          include: {
            attorney: {
              include: { user: true },
            },
          },
        },
      },
    });

    // 2. Also check other attorney profile URLs
    let matchedAttorneyId: string | null = duplicateDoc?.credential?.attorneyId || null;
    let matchedAttorney: any = duplicateDoc?.credential?.attorney || null;

    if (!matchedAttorneyId) {
      const otherProfile = await this.prisma.attorneyProfile.findFirst({
        where: {
          id: { not: currentAttorneyId },
          OR: [
            { licenseBookUrl: cleanKey },
            { barRegistrationUrl: cleanKey },
            { nationalIdDocumentUrl: cleanKey },
            { otherSupportingDocuments: { has: cleanKey } },
          ],
        },
        include: { user: true },
      });

      if (otherProfile) {
        matchedAttorneyId = otherProfile.id;
        matchedAttorney = otherProfile;
      }
    }

    if (!matchedAttorneyId || matchedAttorneyId === currentAttorneyId) {
      return { isDuplicate: false, sha256 };
    }

    this.logger.warn(`FR-VERIF-05: Duplicate document detected! File key "${cleanKey}" (SHA-256: ${sha256}) belongs to attorney ${matchedAttorneyId} and submitted by ${currentAttorneyId}`);

    // 3. Find active verification cases for both accounts
    const [currentCase, matchedCase] = await Promise.all([
      this.prisma.verificationCase.findFirst({
        where: { attorneyId: currentAttorneyId },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.verificationCase.findFirst({
        where: { attorneyId: matchedAttorneyId },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    const fraudMetadata = JSON.stringify({
      matchedAttorneyId,
      matchedAttorneyUserId: matchedAttorney?.userId,
      matchedAttorneyName: matchedAttorney?.fullName || matchedAttorney?.user?.name,
      documentKey: cleanKey,
      sha256,
      flaggedAt: new Date().toISOString(),
    });

    // Flag current case
    if (currentCase) {
      await this.prisma.verificationCase.update({
        where: { id: currentCase.id },
        data: { fraudStatus: 'FRAUD_REVIEW' },
      });

      await this.prisma.fraudReviewCase.create({
        data: {
          verificationCaseId: currentCase.id,
          flaggedByUserId,
          fraudSignalTypes: ['DUPLICATE_DOCUMENT_HASH'],
          status: 'FRAUD_REVIEW',
          notes: `Duplicate document detected with account ${matchedAttorneyId}. Metadata: ${fraudMetadata}`,
        },
      });

      await this.prisma.verificationChecklist.updateMany({
        where: { verificationCaseId: currentCase.id, itemName: 'document_proof_verified' },
        data: { status: 'FAILED', remarks: `Duplicate document SHA-256 hash detected matching account ${matchedAttorneyId}` },
      });
    }

    // Flag matched case
    if (matchedCase) {
      await this.prisma.verificationCase.update({
        where: { id: matchedCase.id },
        data: { fraudStatus: 'FRAUD_REVIEW' },
      });

      await this.prisma.fraudReviewCase.create({
        data: {
          verificationCaseId: matchedCase.id,
          flaggedByUserId,
          fraudSignalTypes: ['DUPLICATE_DOCUMENT_HASH'],
          status: 'FRAUD_REVIEW',
          notes: `Duplicate document detected from account ${currentAttorneyId}. Metadata: ${fraudMetadata}`,
        },
      });
    }

    return {
      isDuplicate: true,
      sha256,
      matchedAttorneyId,
      matchedCaseId: matchedCase?.id,
      currentCaseId: currentCase?.id,
    };
  }

  // Fraud Review Workspace API (SCR-VERIF-03)
  async getFraudWorkspace(caseId: string) {
    const vCase = await this.verificationCaseService.findOne(caseId);
    const fraudCases = await this.prisma.fraudReviewCase.findMany({
      where: { verificationCaseId: caseId },
    });

    const sharedDocuments: any[] = [];
    const suspectedAccounts: any[] = [];

    for (const fc of fraudCases) {
      if (fc.notes && fc.notes.includes('Metadata:')) {
        try {
          const rawMeta = fc.notes.split('Metadata:')[1]?.trim();
          if (rawMeta) {
            const meta = JSON.parse(rawMeta);
            if (meta.documentKey) {
              sharedDocuments.push({
                documentKey: meta.documentKey,
                sha256: meta.sha256,
                matchedAccountIds: [meta.matchedAttorneyId],
                flaggedAt: meta.flaggedAt,
              });
            }
            if (meta.matchedAttorneyId) {
              const matchedAtt = await this.prisma.attorneyProfile.findUnique({
                where: { id: meta.matchedAttorneyId },
                include: { user: true },
              });
              if (matchedAtt) {
                suspectedAccounts.push({
                  attorneyId: matchedAtt.id,
                  userId: matchedAtt.userId,
                  fullName: matchedAtt.fullName || matchedAtt.user?.name,
                  email: matchedAtt.user?.email,
                  verificationStatus: matchedAtt.verificationStatus,
                });
              }
            }
          }
        } catch {
          // ignore json parse error
        }
      }
    }

    return {
      verificationCase: vCase,
      fraudDetails: fraudCases[0] || null,
      fraudCases,
      linkedCaseGraph: {
        sharedDocuments,
        sharedDevices: [],
        suspectedAccounts,
      },
      seniorReviewerDecisionPanelAvailable: true,
    };
  }
}
