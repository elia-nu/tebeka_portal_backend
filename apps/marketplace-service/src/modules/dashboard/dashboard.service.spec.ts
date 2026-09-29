import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { BookingStatus, CaseStatus, Priority } from '@prisma/client/marketplace';

describe('DashboardService (FR-DASH)', () => {
  let service: DashboardService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      booking: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      case: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      review: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should throw BadRequestException if attorneyId is missing', async () => {
    await expect(service.getAttorneyDashboardSummary('')).rejects.toThrow(BadRequestException);
  });

  it('should compile complete attorney dashboard metrics with ratings and urgent cases', async () => {
    prisma.booking.count
      .mockResolvedValueOnce(3) // pendingBookingsCount
      .mockResolvedValueOnce(5) // confirmedBookingsCount
      .mockResolvedValueOnce(12); // totalCompletedBookings

    prisma.booking.findMany.mockResolvedValueOnce([
      { id: 'b-1', attorneyId: 'att-1', startTime: '09:00', status: BookingStatus.CONFIRMED },
      { id: 'b-2', attorneyId: 'att-1', startTime: '14:00', status: BookingStatus.CONFIRMED },
    ]);

    prisma.case.count
      .mockResolvedValueOnce(4) // activeCasesCount
      .mockResolvedValueOnce(1); // urgentCasesCount

    prisma.review.findMany.mockResolvedValueOnce([
      { id: 'rev-1', attorneyId: 'att-1', rating: 5, status: 'PUBLISHED' },
      { id: 'rev-2', attorneyId: 'att-1', rating: 4, status: 'PUBLISHED' },
    ]);

    prisma.case.findMany.mockResolvedValueOnce([
      { id: 'case-1', attorneyId: 'att-1', title: 'Land Dispute', caseMilestones: [] },
    ]);

    const result = await service.getAttorneyDashboardSummary('att-1');

    expect(result.status).toBe('success');
    expect(result.attorneyId).toBe('att-1');
    expect(result.summary.pendingConsultationsCount).toBe(3);
    expect(result.summary.upcomingBookingsCount).toBe(5);
    expect(result.summary.activeCasesCount).toBe(4);
    expect(result.summary.urgentCasesCount).toBe(1);
    expect(result.summary.totalCompletedBookings).toBe(12);
    expect(result.summary.averageRating).toBe(4.5);
    expect(result.summary.reviewCount).toBe(2);
    expect(result.todaySchedule).toHaveLength(2);
    expect(result.recentCases).toHaveLength(1);
  });
});
