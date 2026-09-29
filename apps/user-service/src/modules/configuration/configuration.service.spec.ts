import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigurationService } from './configuration.service';
import { PrismaService } from '@workspace/database';

describe('ConfigurationService (FR-ADMIN Dual Approval / Maker-Checker)', () => {
  let service: ConfigurationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      makerCheckerConfigChange: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigurationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ConfigurationService>(ConfigurationService);
  });

  it('should reject proposal for ungoverned config keys', async () => {
    await expect(
      service.proposeConfigChange({ key: 'invalidKey', proposedValue: 123, adminId: 'admin-1' })
    ).rejects.toThrow(BadRequestException);
  });

  it('should create proposal in PENDING_APPROVAL status for governed keys', async () => {
    prisma.makerCheckerConfigChange.create.mockResolvedValue({
      id: 'prop-1',
      key: 'commissionRates',
      proposedValue: { standardPercentage: 12.0, premiumPercentage: 8.0 },
      submittedByAdminId: 'admin-1',
      status: 'PENDING_APPROVAL',
    });

    const res = await service.proposeConfigChange({
      key: 'commissionRates',
      proposedValue: { standardPercentage: 12.0, premiumPercentage: 8.0 },
      adminId: 'admin-1',
    });

    expect(res.status).toBe('PENDING_APPROVAL');
    expect(res.proposal.id).toBe('prop-1');
  });

  it('should prevent self-approval by the proposer admin (Maker-Checker Invariant)', async () => {
    prisma.makerCheckerConfigChange.findUnique.mockResolvedValue({
      id: 'prop-1',
      key: 'commissionRates',
      proposedValue: { standardPercentage: 12.0 },
      submittedByAdminId: 'admin-1',
      status: 'PENDING_APPROVAL',
    });

    await expect(service.approveConfigChange('prop-1', 'admin-1')).rejects.toThrow(ForbiddenException);
  });

  it('should allow a second admin (Admin B) to approve and activate the configuration change', async () => {
    prisma.makerCheckerConfigChange.findUnique.mockResolvedValue({
      id: 'prop-1',
      key: 'commissionRates',
      proposedValue: { standardPercentage: 12.0, premiumPercentage: 8.0 },
      submittedByAdminId: 'admin-1',
      status: 'PENDING_APPROVAL',
    });

    prisma.makerCheckerConfigChange.update.mockResolvedValue({
      id: 'prop-1',
      status: 'APPROVED',
      approvedByAdminId: 'admin-2',
      effectiveAt: new Date(),
    });

    const res = await service.approveConfigChange('prop-1', 'admin-2');

    expect(res.status).toBe('APPROVED');
    expect(res.activeSettings.commissionRates).toEqual({ standardPercentage: 12.0, premiumPercentage: 8.0 });
  });

  it('should prevent self-rejection by the submitting admin', async () => {
    prisma.makerCheckerConfigChange.findUnique.mockResolvedValue({
      id: 'prop-1',
      submittedByAdminId: 'admin-1',
      status: 'PENDING_APPROVAL',
    });

    await expect(service.rejectConfigChange('prop-1', 'admin-1', 'changed mind')).rejects.toThrow(ForbiddenException);
  });

  it('should allow rejection by a second admin', async () => {
    prisma.makerCheckerConfigChange.findUnique.mockResolvedValue({
      id: 'prop-1',
      submittedByAdminId: 'admin-1',
      status: 'PENDING_APPROVAL',
    });

    prisma.makerCheckerConfigChange.update.mockResolvedValue({
      id: 'prop-1',
      status: 'REJECTED',
      approvedByAdminId: 'admin-2',
    });

    const res = await service.rejectConfigChange('prop-1', 'admin-2', 'Risk too high');
    expect(res.status).toBe('REJECTED');
  });
});
