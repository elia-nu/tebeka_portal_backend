import { Test, TestingModule } from '@nestjs/testing';
import { ReviewService } from './review.service';
import { PrismaService } from '../../database/prisma.service';
import { ReviewStatus } from '@prisma/client/marketplace';

describe('ReviewService (Moderation Queue & Reports)', () => {
  let service: ReviewService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      review: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'rev-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      reviewReport: {
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'rep-1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'rep-1', ...data })),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'out-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  it('should list review reports with 1-business-day SLA calculation', async () => {
    mockPrisma.reviewReport.findMany.mockResolvedValue([
      {
        id: 'rep-1',
        reviewId: 'rev-1',
        reportedBy: 'user-1',
        reason: 'Inappropriate language and spam',
        status: 'PENDING',
        createdAt: new Date(),
        review: { id: 'rev-1', rating: 1, comment: 'Bad' },
      },
    ]);
    mockPrisma.reviewReport.count.mockResolvedValue(1);

    const res = await service.getReviewReports({ page: 1, limit: 10 });

    expect(res.items.length).toBe(1);
    expect(res.items[0].sla.targetBusinessDays).toBe(1);
    expect(res.items[0].sla.slaDeadline).toBeDefined();
    expect(res.items[0].sla.isBreached).toBe(false);
  });

  it('should update review report moderation status and hide review if requested', async () => {
    mockPrisma.reviewReport.findUnique.mockResolvedValue({
      id: 'rep-1',
      reviewId: 'rev-1',
      status: 'PENDING',
    });

    const res = await service.updateReviewReport(
      'rep-1',
      { status: 'ACTIONED', actionTaken: 'HIDDEN_DEFAMATORY', reviewStatus: ReviewStatus.HIDDEN, adminNotes: 'Verified violation' },
      'admin-1'
    );

    expect(mockPrisma.reviewReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rep-1' },
        data: expect.objectContaining({
          status: 'ACTIONED',
          actionTaken: 'HIDDEN_DEFAMATORY',
          resolvedBy: 'admin-1',
        }),
      })
    );
    expect(mockPrisma.review.update).toHaveBeenCalledWith({
      where: { id: 'rev-1' },
      data: { status: ReviewStatus.HIDDEN },
    });
  });
});
