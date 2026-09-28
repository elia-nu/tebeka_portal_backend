import { Test, TestingModule } from '@nestjs/testing';
import { VerificationFraudService } from './services/verification-fraud.service';
import { VerificationCaseService } from './services/verification-case.service';
import { PrismaService } from '@workspace/database';

describe('VerificationFraudService - Duplicate Document Hash (FR-VERIF-05)', () => {
  let service: VerificationFraudService;
  let mockPrisma: any;
  let mockVerificationCaseService: any;

  beforeEach(async () => {
    mockPrisma = {
      attorneyProfile: {
        update: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      verificationCase: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      credentialDocument: {
        findFirst: jest.fn(),
      },
      fraudReviewCase: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      verificationChecklist: {
        updateMany: jest.fn(),
      },
    };

    mockVerificationCaseService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationFraudService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: VerificationCaseService, useValue: mockVerificationCaseService },
      ],
    }).compile();

    service = module.get<VerificationFraudService>(VerificationFraudService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAndFlagDuplicateDocument', () => {
    it('should return isDuplicate: false if no duplicate document matches another account', async () => {
      mockPrisma.credentialDocument.findFirst.mockResolvedValue(null);
      mockPrisma.attorneyProfile.findFirst.mockResolvedValue(null);

      const result = await service.checkAndFlagDuplicateDocument('att-1', 'credentials/unique_doc.pdf');
      expect(result.isDuplicate).toBe(false);
      expect(result.sha256).toBeDefined();
    });

    it('should detect duplicate document and flag both cases with FRAUD_REVIEW (FR-VERIF-05)', async () => {
      mockPrisma.credentialDocument.findFirst.mockResolvedValue({
        id: 'doc-existing',
        fileKey: 'credentials/shared_license.pdf',
        credential: {
          attorneyId: 'att-target',
          attorney: {
            id: 'att-target',
            userId: 'usr-target',
            fullName: 'Existing Attorney',
          },
        },
      });

      mockPrisma.verificationCase.findFirst
        .mockResolvedValueOnce({ id: 'case-current', attorneyId: 'att-current' })
        .mockResolvedValueOnce({ id: 'case-target', attorneyId: 'att-target' });

      mockPrisma.verificationCase.update.mockResolvedValue({});
      mockPrisma.fraudReviewCase.create.mockResolvedValue({ id: 'fraud-1' });

      const result = await service.checkAndFlagDuplicateDocument('att-current', 'credentials/shared_license.pdf');

      expect(result.isDuplicate).toBe(true);
      expect(result.matchedAttorneyId).toBe('att-target');
      expect(mockPrisma.verificationCase.update).toHaveBeenCalledWith({
        where: { id: 'case-current' },
        data: { fraudStatus: 'FRAUD_REVIEW' },
      });
      expect(mockPrisma.verificationCase.update).toHaveBeenCalledWith({
        where: { id: 'case-target' },
        data: { fraudStatus: 'FRAUD_REVIEW' },
      });
      expect(mockPrisma.fraudReviewCase.create).toHaveBeenCalled();
    });
  });

  describe('getFraudWorkspace', () => {
    it('should build linkedCaseGraph with shared documents and suspected accounts', async () => {
      mockVerificationCaseService.findOne.mockResolvedValue({ id: 'case-1', status: 'PENDING_REVIEW' });
      mockPrisma.fraudReviewCase.findMany.mockResolvedValue([
        {
          id: 'fc-1',
          verificationCaseId: 'case-1',
          notes: 'Metadata: {"matchedAttorneyId":"att-2","documentKey":"credentials/dup.pdf","sha256":"abc123hash"}',
        },
      ]);

      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({
        id: 'att-2',
        userId: 'usr-2',
        fullName: 'Suspect Attorney',
        verificationStatus: 'PENDING_REVIEW',
        user: { email: 'suspect@tebeka.et', name: 'Suspect Attorney' },
      });

      const workspace = await service.getFraudWorkspace('case-1');
      expect(workspace.linkedCaseGraph.sharedDocuments.length).toBe(1);
      expect(workspace.linkedCaseGraph.sharedDocuments[0].documentKey).toBe('credentials/dup.pdf');
      expect(workspace.linkedCaseGraph.suspectedAccounts.length).toBe(1);
      expect(workspace.linkedCaseGraph.suspectedAccounts[0].attorneyId).toBe('att-2');
    });
  });
});
