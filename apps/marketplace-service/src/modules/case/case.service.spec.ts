import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CaseService } from './case.service';
import { PrismaService } from '../../database/prisma.service';
import { CaseStatus, MilestoneStatus } from '@prisma/client/marketplace';

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
      caseMilestone: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({ id: `m-${Date.now()}`, ...data })),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'm-1', ...data })),
        count: jest.fn().mockResolvedValue(0),
      },
      caseTimeline: {
        create: jest.fn().mockResolvedValue({ id: 'tl-1' }),
        findMany: jest.fn().mockResolvedValue([]),
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

  describe('Case Creation (FR-CASE-01 & FR-CASE-04)', () => {
    it('should create case without automatic milestones, leaving milestone creation to the attorney', async () => {
      await service.createCase(
        {
          title: 'Labor Contract Dispute',
          description: 'Wrongful termination claim against employer.',
          attorneyId: 'att-1',
        },
        'client-1'
      );

      expect(mockPrisma.case.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            caseMilestones: expect.anything(),
          }),
        })
      );
    });
  });

  describe('TC-CASE-01: Conflict of Interest (COI) Gate & Acceptance (FR-CASE-02 / BR-CASE-01)', () => {
    it('should block case acceptance when attorney declares a conflict of interest', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-101',
        clientId: 'client-1',
        attorneyId: 'att-1',
        status: CaseStatus.OPEN,
      });

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

    it('should transition case to ACCEPTED (awaiting milestones) when attorney passes COI declaration', async () => {
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
            status: CaseStatus.ACCEPTED,
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

  describe('SRS FR-CASE-04: Milestone plan agreed by both parties', () => {
    describe('1. Attorney Milestone Proposal on ACCEPTED Case', () => {
      it('should allow assigned attorney to propose milestones when case is ACCEPTED', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-accepted-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.ACCEPTED,
          caseMilestones: [],
        });

        const proposal = {
          milestones: [
            { title: 'Milestone 1: Preliminary Brief', dueDate: '2026-11-01T00:00:00.000Z' },
            { title: 'Milestone 2: Court Filing', dueDate: '2026-11-15T00:00:00.000Z' },
          ],
        };

        const res = await service.proposeMilestones('case-accepted-1', proposal, 'att-1');

        expect(Array.isArray(res)).toBe(true);
        expect(res).toHaveLength(2);
        expect(mockPrisma.caseMilestone.create).toHaveBeenCalledTimes(2);
        expect(mockPrisma.caseMilestone.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            caseId: 'case-accepted-1',
            title: 'Milestone 1: Preliminary Brief',
            status: MilestoneStatus.PROPOSED,
            proposedBy: 'att-1',
            approvedByClientAt: null,
          }),
        });
        expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            eventType: 'MILESTONES_PROPOSED',
          }),
        });
      });

      it('should block milestone proposal if case is not yet ACCEPTED (e.g., still OPEN)', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-open-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.OPEN,
          caseMilestones: [],
        });

        await expect(
          service.proposeMilestones('case-open-1', { title: 'Early milestone' }, 'att-1')
        ).rejects.toThrow(BadRequestException);
      });

      it('should block non-attorney from proposing milestones', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-accepted-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.ACCEPTED,
          caseMilestones: [],
        });

        await expect(
          service.proposeMilestones('case-accepted-1', { title: 'Client proposed' }, 'client-1')
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('2. Client Approval Before IN_PROGRESS', () => {
      it('should block transition to IN_PROGRESS if milestones are unapproved by client', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-accepted-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.ACCEPTED,
          caseMilestones: [
            { id: 'm-1', title: 'Phase 1', approvedByClientAt: null, status: MilestoneStatus.PROPOSED },
          ],
        });

        await expect(
          service.updateCaseStatus('case-accepted-1', CaseStatus.IN_PROGRESS, 'att-1')
        ).rejects.toThrow(BadRequestException);
      });

      it('should block transition to IN_PROGRESS if case has no milestones', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-accepted-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.ACCEPTED,
          caseMilestones: [],
        });

        await expect(
          service.updateCaseStatus('case-accepted-1', CaseStatus.IN_PROGRESS, 'att-1')
        ).rejects.toThrow(BadRequestException);
      });

      it('should allow client to approve milestones and transition case to IN_PROGRESS', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-accepted-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.ACCEPTED,
          caseMilestones: [
            { id: 'm-1', title: 'Phase 1', approvedByClientAt: null, status: MilestoneStatus.PROPOSED },
            { id: 'm-2', title: 'Phase 2', approvedByClientAt: null, status: MilestoneStatus.PROPOSED },
          ],
        });
        mockPrisma.caseMilestone.count.mockResolvedValue(0); // 0 remaining unapproved

        const res = await service.approveMilestones('case-accepted-1', {}, 'client-1');

        expect(res.message).toBe('Milestones approved successfully');
        expect(mockPrisma.caseMilestone.update).toHaveBeenCalledTimes(2);
        expect(mockPrisma.caseMilestone.update).toHaveBeenCalledWith({
          where: { id: 'm-1' },
          data: expect.objectContaining({
            status: MilestoneStatus.APPROVED,
            approvedByClientAt: expect.any(Date),
          }),
        });
        // Case transitions to IN_PROGRESS
        expect(mockPrisma.case.update).toHaveBeenCalledWith({
          where: { id: 'case-accepted-1' },
          data: { status: CaseStatus.IN_PROGRESS },
        });
        expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            eventType: 'CASE_IN_PROGRESS',
          }),
        });
      });

      it('should block attorney from approving proposed milestones', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-accepted-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.ACCEPTED,
          caseMilestones: [
            { id: 'm-1', title: 'Phase 1', approvedByClientAt: null, status: MilestoneStatus.PROPOSED },
          ],
        });

        await expect(
          service.approveMilestones('case-accepted-1', {}, 'att-1')
        ).rejects.toThrow(ForbiddenException);
      });
    });

    describe('3. Milestone Completion Requires Client Acknowledgement', () => {
      it('should transition milestone to PENDING_CLIENT_APPROVAL when attorney submits completion deliverable', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-prog-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.IN_PROGRESS,
        });
        mockPrisma.caseMilestone.findFirst.mockResolvedValue({
          id: 'm-1',
          caseId: 'case-prog-1',
          title: 'Phase 1: Statement of Claim Draft',
          status: MilestoneStatus.APPROVED,
          approvedByClientAt: new Date(),
        });

        const res = await service.completeMilestone(
          'case-prog-1',
          'm-1',
          'att-1',
          'Filed at Federal High Court, file stamp attached.'
        );

        expect(res.message).toContain('Awaiting client acknowledgement');
        expect(mockPrisma.caseMilestone.update).toHaveBeenCalledWith({
          where: { id: 'm-1' },
          data: expect.objectContaining({
            status: MilestoneStatus.PENDING_CLIENT_APPROVAL,
            completedAt: expect.any(Date),
          }),
        });
        expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            eventType: 'MILESTONE_COMPLETION_REQUESTED',
          }),
        });
      });

      it('should block completing a milestone that was not approved by client', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-prog-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.IN_PROGRESS,
        });
        mockPrisma.caseMilestone.findFirst.mockResolvedValue({
          id: 'm-unapproved',
          caseId: 'case-prog-1',
          title: 'Unapproved Phase',
          status: MilestoneStatus.PROPOSED,
          approvedByClientAt: null,
        });

        await expect(
          service.completeMilestone('case-prog-1', 'm-unapproved', 'att-1')
        ).rejects.toThrow(BadRequestException);
      });

      it('should finalize milestone to COMPLETED when client acknowledges completion', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-prog-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.IN_PROGRESS,
        });
        mockPrisma.caseMilestone.findFirst.mockResolvedValue({
          id: 'm-1',
          caseId: 'case-prog-1',
          title: 'Phase 1: Statement of Claim Draft',
          status: MilestoneStatus.PENDING_CLIENT_APPROVAL,
          approvedByClientAt: new Date(),
        });

        const res = await service.acknowledgeMilestone(
          'case-prog-1',
          'm-1',
          'client-1',
          { feedback: 'Received and verified, great work!', rating: 5 }
        );

        expect(res.message).toBe('Milestone completion acknowledged successfully');
        expect(mockPrisma.caseMilestone.update).toHaveBeenCalledWith({
          where: { id: 'm-1' },
          data: expect.objectContaining({
            status: MilestoneStatus.COMPLETED,
            acknowledgedByClientAt: expect.any(Date),
          }),
        });
        expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            eventType: 'MILESTONE_ACKNOWLEDGED',
            payload: expect.objectContaining({
              rating: 5,
              feedback: 'Received and verified, great work!',
            }),
          }),
        });
      });

      it('should block attorney from self-acknowledging milestone completion', async () => {
        mockPrisma.case.findUnique.mockResolvedValue({
          id: 'case-prog-1',
          clientId: 'client-1',
          attorneyId: 'att-1',
          status: CaseStatus.IN_PROGRESS,
        });
        mockPrisma.caseMilestone.findFirst.mockResolvedValue({
          id: 'm-1',
          caseId: 'case-prog-1',
          title: 'Phase 1',
          status: MilestoneStatus.PENDING_CLIENT_APPROVAL,
          approvedByClientAt: new Date(),
        });

        await expect(
          service.acknowledgeMilestone('case-prog-1', 'm-1', 'att-1')
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });
});

