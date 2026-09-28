import { Test, TestingModule } from '@nestjs/testing';
import { AttorneyProfileChangeService } from './services/attorney-profile-change.service';
import { PrismaService } from '@workspace/database';

describe('AttorneyProfileChangeService - Guarded Fields for Practice Areas & Documents', () => {
  let service: AttorneyProfileChangeService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      attorneyProfile: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      guardedChange: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      verificationCase: {
        create: jest.fn(),
        update: jest.fn(),
      },
      verificationChecklist: {
        updateMany: jest.fn(),
      },
      credential: {
        updateMany: jest.fn(),
      },
      user: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttorneyProfileChangeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AttorneyProfileChangeService>(AttorneyProfileChangeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestProfileChange for Practice Areas & Documents', () => {
    it('should create a GUARDED_CHANGE verification case and checklist for practiceAreas', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({
        id: 'att-1',
        practiceAreas: ['Corporate Law'],
      });

      mockPrisma.verificationCase.create.mockResolvedValue({ id: 'vcase-1' });
      mockPrisma.guardedChange.create.mockResolvedValue({
        id: 'gc-1',
        field: 'practiceAreas',
        newValue: JSON.stringify(['Corporate Law', 'Real Estate']),
        verificationCaseId: 'vcase-1',
      });

      const res = await service.requestProfileChange('att-1', {
        field: 'practiceAreas',
        newValue: ['Corporate Law', 'Real Estate'],
      });

      expect(res.status).toBe('success');
      expect(res.verificationCaseId).toBe('vcase-1');
      expect(mockPrisma.verificationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseType: 'GUARDED_CHANGE',
            status: 'SUBMITTED',
            checklists: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ itemName: 'practice_area_qualification' }),
              ]),
            }),
          }),
        })
      );
    });

    it('should create a GUARDED_CHANGE verification case for credential documents', async () => {
      mockPrisma.attorneyProfile.findUnique.mockResolvedValue({
        id: 'att-1',
        barRegistrationUrl: 'credentials/old_bar.pdf',
      });

      mockPrisma.verificationCase.create.mockResolvedValue({ id: 'vcase-2' });
      mockPrisma.guardedChange.create.mockResolvedValue({
        id: 'gc-2',
        field: 'barRegistrationUrl',
        newValue: 'credentials/new_bar.pdf',
        verificationCaseId: 'vcase-2',
      });

      const res = await service.requestProfileChange('att-1', {
        field: 'barRegistrationUrl',
        newValue: 'credentials/new_bar.pdf',
      });

      expect(res.status).toBe('success');
      expect(mockPrisma.verificationCase.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            checklists: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ itemName: 'credential_document_verified' }),
              ]),
            }),
          }),
        })
      );
    });
  });

  describe('approveProfileChange', () => {
    it('should atomically update attorneyProfile practiceAreas upon approval', async () => {
      mockPrisma.guardedChange.findUnique.mockResolvedValue({
        id: 'gc-1',
        attorneyId: 'att-1',
        field: 'practiceAreas',
        newValue: JSON.stringify(['Corporate Law', 'Tax Law']),
        verificationCaseId: 'vcase-1',
        status: 'PENDING',
      });

      mockPrisma.guardedChange.update.mockResolvedValue({
        id: 'gc-1',
        status: 'APPROVED',
      });

      mockPrisma.guardedChange.count.mockResolvedValue(0);
      mockPrisma.attorneyProfile.update.mockResolvedValue({});
      mockPrisma.verificationCase.update.mockResolvedValue({});
      mockPrisma.verificationChecklist.updateMany.mockResolvedValue({});

      const res = await service.approveProfileChange('gc-1', 'admin-reviewer-1');
      expect(res.status).toBe('APPROVED');
      expect(mockPrisma.attorneyProfile.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: { practiceAreas: ['Corporate Law', 'Tax Law'] },
      });
      expect(mockPrisma.verificationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vcase-1' },
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      );
    });
  });
});
