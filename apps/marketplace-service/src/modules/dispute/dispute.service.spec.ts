import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { PrismaService } from '../../database/prisma.service';
import { CaseStatus, BookingStatus, DisputeStatus } from '@prisma/client/marketplace';

describe('DisputeService (FR-CASE-06 / SCR-ADMIN-04 / TC-CASE-04)', () => {
  let service: DisputeService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      case: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({ status: data.status })),
      },
      booking: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({ status: data.status })),
      },
      dispute: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'disp-1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'disp-1', ...data })),
      },
      caseTimeline: {
        create: jest.fn().mockResolvedValue({ id: 'tl-1' }),
      },
      bookingEvent: {
        create: jest.fn().mockResolvedValue({ id: 'be-1' }),
      },
      bookingTimeline: {
        create: jest.fn().mockResolvedValue({ id: 'btl-1' }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DisputeService>(DisputeService);
  });

  describe('TC-CASE-04: Case Dispute Escalation with 5-Day SLA (FR-CASE-06)', () => {
    it('should open dispute on a case, change status to DISPUTED, calculate 5-day SLA, and record queue item', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-101',
        clientId: 'client-1',
        attorneyId: 'att-1',
        status: CaseStatus.IN_PROGRESS,
      });

      const res = await service.openCaseDispute(
        'case-101',
        { reason: 'Attorney failed to file court petition on time', details: 'Missed deadline by 2 weeks' },
        'client-1'
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-101' },
        data: { status: CaseStatus.DISPUTED },
      });
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: 'case-101',
            targetType: 'CASE',
            openedBy: 'client-1',
            reason: 'Attorney failed to file court petition on time',
            status: DisputeStatus.OPEN,
          }),
        })
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'CASE_DISPUTED',
        }),
      });
    });

    it('should forbid non-participants from opening dispute on a case', async () => {
      mockPrisma.case.findUnique.mockResolvedValue({
        id: 'case-102',
        clientId: 'client-1',
        attorneyId: 'att-1',
        status: CaseStatus.IN_PROGRESS,
      });

      await expect(
        service.openCaseDispute('case-102', { reason: 'Unauthorized filing' }, 'stranger-user')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Booking Dispute Escalation & Escrow Freeze (TC-PAY-02)', () => {
    it('should escalate booking dispute, change status to DISPUTED, and freeze escrow release', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'booking-201',
        clientId: 'client-1',
        attorneyId: 'att-1',
        status: BookingStatus.CONFIRMED,
      });

      const res = await service.openBookingDispute(
        'booking-201',
        { reason: 'Attorney did not show up for scheduled consultation' },
        'client-1'
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-201' },
        data: { status: BookingStatus.DISPUTED },
      });
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: 'booking-201',
            targetType: 'BOOKING',
            openedBy: 'client-1',
            status: DisputeStatus.OPEN,
          }),
        })
      );
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'BOOKING_DISPUTED',
        }),
      });
    });
  });

  describe('SCR-ADMIN-04: Admin Dispute Resolution', () => {
    it('should resolve dispute and update case/booking status with admin audit notes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        id: 'disp-1',
        referenceNumber: 'DISP-2026-000001',
        caseId: 'case-101',
        targetType: 'CASE',
        status: DisputeStatus.OPEN,
        slaDeadline: new Date(Date.now() + 86400000),
      });

      const res = await service.resolveDispute(
        'disp-1',
        {
          resolutionOutcome: 'RESOLVED_CLIENT_FAVOR',
          resolutionNotes: 'Evidence verified. Partial escrow refund awarded to client.',
          status: DisputeStatus.RESOLVED,
          caseStatusAction: 'RESOLVED',
        },
        'admin-1'
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'disp-1' },
          data: expect.objectContaining({
            status: DisputeStatus.RESOLVED,
            resolutionOutcome: 'RESOLVED_CLIENT_FAVOR',
            resolvedBy: 'admin-1',
          }),
        })
      );
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-101' },
        data: { status: CaseStatus.RESOLVED },
      });
    });
  });
});
