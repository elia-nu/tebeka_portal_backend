import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CaseService } from './case.service';
import { PrismaService } from '../../database/prisma.service';
import { CaseStatus } from '@prisma/client/marketplace';

describe('CaseService (FR-CASE Unit Tests)', () => {
  let service: CaseService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      case: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({ status: data.status, conflictAcknowledged: data.conflictAcknowledged })),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'case-101', ...data })),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
  });

  describe('TC-CASE-01: Conflict of Interest (COI) Gate (BR-CASE-01)', () => {
    it('should block case acceptance when attorney declares a conflict of interest', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-101',
        clientId: 'client-1',
        attorneyId: 'att-1',
        status: CaseStatus.OPEN,
      });

      // Attorney submits decision with hasConflict = true
      await expect(
        service.recordCaseDecision(
          'case-101',
          'ACCEPT',
          { hasConflict: true, answers: { priorRepresentation: true } },
          'att-1'
        )
      ).rejects.toThrow(BadRequestException);

      try {
        await service.recordCaseDecision(
          'case-101',
          'ACCEPT',
          { hasConflict: true, answers: { priorRepresentation: true } },
          'att-1'
        );
      } catch (err: any) {
        expect(err.getResponse().code).toBe('CONFLICT_OF_INTEREST_DECLARED');
      }
    });

    it('should allow case acceptance when attorney passes COI declaration (hasConflict = false)', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-102',
        clientId: 'client-1',
        attorneyId: 'att-1',
        status: CaseStatus.OPEN,
      });

      const res = await service.recordCaseDecision(
        'case-102',
        'ACCEPT',
        { hasConflict: false, answers: { priorRepresentation: false, adverseInterest: false } },
        'att-1'
      );

      expect(res.status).toBe('ACCEPTED');
      expect(mockPrisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CaseStatus.IN_PROGRESS,
            conflictAcknowledged: true,
          }),
        })
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'CASE_ACCEPTED',
        }),
      });
    });

    it('should block non-assigned attorney from recording case decision', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-103',
        clientId: 'client-1',
        attorneyId: 'att-1',
        status: CaseStatus.OPEN,
      });

      await expect(
        service.recordCaseDecision(
          'case-103',
          'ACCEPT',
          { hasConflict: false },
          'unauthorized-attorney'
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
