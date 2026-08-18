import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class ConfigurationService {
  private currentSettings = {
    version: 3,
    siteName: 'Tebeka Legal Portal',
    allowAttorneyRegistration: true,
    requireBarVerification: true,
    defaultLocale: 'en',
    supportedLocales: ['en', 'am'],
    maxUploadSizeBytes: 10485760,
    rankingWeights: { verification: 30, responsiveness: 25, rating: 25, experience: 20 },
    commissionRates: { standardPercentage: 10.0, premiumPercentage: 7.5 },
    feeBands: ['STANDARD', 'PREMIUM', 'EXECUTIVE'],
    cancellationPolicies: { clientGracePeriodHours: 24, penaltyPercentage: 15.0 },
    updatedAt: new Date(),
  };

  private history: any[] = [
    { version: 1, siteName: 'Tebeka Portal', allowAttorneyRegistration: true, requireBarVerification: false, defaultLocale: 'en', supportedLocales: ['en', 'am'], maxUploadSizeBytes: 10485760, rankingWeights: { verification: 30, responsiveness: 25, rating: 25, experience: 20 }, commissionRates: { standardPercentage: 10.0, premiumPercentage: 7.5 }, feeBands: ['STANDARD'], cancellationPolicies: { clientGracePeriodHours: 24, penaltyPercentage: 15.0 }, updatedAt: new Date(Date.now() - 86400000 * 30) },
    { version: 2, siteName: 'Tebeka Legal Portal', allowAttorneyRegistration: true, requireBarVerification: false, defaultLocale: 'en', supportedLocales: ['en', 'am'], maxUploadSizeBytes: 10485760, rankingWeights: { verification: 30, responsiveness: 25, rating: 25, experience: 20 }, commissionRates: { standardPercentage: 10.0, premiumPercentage: 7.5 }, feeBands: ['STANDARD'], cancellationPolicies: { clientGracePeriodHours: 24, penaltyPercentage: 15.0 }, updatedAt: new Date(Date.now() - 86400000 * 10) },
    { version: 3, siteName: 'Tebeka Legal Portal', allowAttorneyRegistration: true, requireBarVerification: true, defaultLocale: 'en', supportedLocales: ['en', 'am'], maxUploadSizeBytes: 10485760, rankingWeights: { verification: 30, responsiveness: 25, rating: 25, experience: 20 }, commissionRates: { standardPercentage: 10.0, premiumPercentage: 7.5 }, feeBands: ['STANDARD'], cancellationPolicies: { clientGracePeriodHours: 24, penaltyPercentage: 15.0 }, updatedAt: new Date() },
  ];

  async getSettings() {
    return this.currentSettings;
  }

  // Dual-Approval (Maker-Checker) Proposal Submission
  async proposeConfigChange(data: { key: string; proposedValue: any; adminId: string }) {
    const governedKeys = ['rankingWeights', 'commissionRates', 'feeBands', 'cancellationPolicies'];
    if (!governedKeys.includes(data.key)) {
      throw new BadRequestException(`Key '${data.key}' is not governed by Dual-Approval. Allowed keys: ${governedKeys.join(', ')}`);
    }

    const proposal = await prisma.makerCheckerConfigChange.create({
      data: {
        key: data.key,
        proposedValue: data.proposedValue,
        oldValue: (this.currentSettings as any)[data.key] || null,
        submittedByAdminId: data.adminId,
        status: 'PENDING_APPROVAL'
      }
    });

    return {
      status: 'PENDING_APPROVAL',
      message: `Config change proposal for '${data.key}' created. Requires secondary Admin approval.`,
      proposal
    };
  }

  // Dual-Approval Approval by Admin B
  async approveConfigChange(proposalId: string, approvingAdminId: string) {
    const proposal = await prisma.makerCheckerConfigChange.findUnique({
      where: { id: proposalId }
    });

    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);

    if (proposal.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Proposal is already ${proposal.status}`);
    }

    // Invariant: Admin B cannot approve own proposal
    if (proposal.submittedByAdminId === approvingAdminId) {
      throw new ForbiddenException({
        code: 'MAKER_CHECKER_SELF_APPROVAL_PROHIBITED',
        message: 'Admin cannot approve their own configuration proposal. A second Admin is required.'
      });
    }

    // Apply change to currentSettings
    (this.currentSettings as any)[proposal.key] = proposal.proposedValue;
    this.currentSettings.version += 1;
    this.currentSettings.updatedAt = new Date();
    this.history.push({ ...this.currentSettings });

    const updatedProposal = await prisma.makerCheckerConfigChange.update({
      where: { id: proposalId },
      data: {
        status: 'APPROVED',
        approvedByAdminId: approvingAdminId,
        effectiveAt: new Date()
      }
    });

    return {
      status: 'APPROVED',
      message: `Proposal approved and activated in SystemConfig (v${this.currentSettings.version})`,
      proposal: updatedProposal,
      activeSettings: this.currentSettings
    };
  }

  async getPendingProposals() {
    return prisma.makerCheckerConfigChange.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' }
    });
  }

  async rejectConfigChange(proposalId: string, rejectingAdminId: string, reason?: string) {
    const proposal = await prisma.makerCheckerConfigChange.findUnique({
      where: { id: proposalId }
    });

    if (!proposal) throw new NotFoundException(`Proposal ${proposalId} not found`);

    if (proposal.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Proposal is already ${proposal.status}`);
    }

    if (proposal.submittedByAdminId === rejectingAdminId) {
      throw new ForbiddenException({
        code: 'MAKER_CHECKER_SELF_REJECTION_PROHIBITED',
        message: 'Admin cannot reject their own configuration proposal. A second Admin is required.'
      });
    }

    const updatedProposal = await prisma.makerCheckerConfigChange.update({
      where: { id: proposalId },
      data: {
        status: 'REJECTED',
        approvedByAdminId: rejectingAdminId,
      }
    });

    return {
      status: 'REJECTED',
      message: `Proposal rejected by admin ${rejectingAdminId}${reason ? `: ${reason}` : ''}`,
      proposal: updatedProposal
    };
  }

  async updateSettings(data: any) {
    this.currentSettings = {
      ...this.currentSettings,
      ...data,
      version: this.currentSettings.version + 1,
      updatedAt: new Date(),
    };
    this.history.push({ ...this.currentSettings });
    return this.currentSettings;
  }

  async getSettingsHistory() {
    return this.history;
  }

  async restoreSettingsVersion(version: number) {
    const historical = this.history.find(h => h.version === Number(version));
    if (!historical) throw new NotFoundException(`Settings version ${version} not found`);
    this.currentSettings = {
      ...historical,
      version: this.currentSettings.version + 1,
      updatedAt: new Date(),
    };
    return this.currentSettings;
  }
}
