import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { ReviewController } from '../review/review.controller';
import { ReviewService } from '../review/review.service';
import { MessageController } from '../../../../communication-service/src/modules/message/message.controller';
import { MessageService } from '../../../../communication-service/src/modules/message/message.service';
import { JwtAuthGuard, RolesGuard } from '@workspace/auth';

describe('SCR-ADMIN-04 Endpoints Full Integration Test', () => {
  let app: INestApplication;

  const mockDisputeService = {
    openCaseDispute: jest.fn().mockImplementation((caseId, dto, userId) => Promise.resolve({
      id: 'disp-case-001',
      caseId,
      raisedBy: userId,
      reason: dto.reason,
      status: 'OPEN',
      slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    })),
    openBookingDispute: jest.fn().mockImplementation((bookingId, dto, userId) => Promise.resolve({
      id: 'disp-book-001',
      bookingId,
      raisedBy: userId,
      reason: dto.reason,
      status: 'OPEN',
      slaDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    })),
    getDisputes: jest.fn().mockImplementation((query) => Promise.resolve({
      disputes: [
        {
          id: 'disp-001',
          status: query?.status || 'OPEN',
          reason: 'Service not delivered',
          targetType: 'CASE',
          slaHoursRemaining: 120,
          isOverdue: false,
          slaChip: '5 days left',
        }
      ],
      total: 1,
      page: 1,
      limit: 10,
    })),
    getDisputeById: jest.fn().mockImplementation((id) => Promise.resolve({
      id,
      status: 'OPEN',
      reason: 'Attorney missed appointment',
      targetType: 'BOOKING',
      slaHoursRemaining: 48,
      isOverdue: false,
      slaChip: '2 days left',
    })),
    resolveDispute: jest.fn().mockImplementation((id, dto, adminId) => Promise.resolve({
      id,
      status: 'RESOLVED',
      resolutionOutcome: dto.resolutionOutcome,
      resolutionNotes: dto.resolutionNotes,
      resolvedBy: adminId,
      resolvedAt: new Date().toISOString(),
    })),
  };

  const mockReviewService = {
    reportReview: jest.fn().mockImplementation((id, body, userId) => Promise.resolve({
      id: 'rep-001',
      reviewId: id,
      reason: body.reason,
      status: 'PENDING',
      reportedBy: userId,
    })),
    getReviewReports: jest.fn().mockImplementation((query) => Promise.resolve({
      reports: [
        {
          id: 'rep-001',
          reviewId: 'rev-001',
          status: query?.status || 'PENDING',
          reason: 'Defamatory language',
          slaHoursRemaining: 24,
          isOverdue: false,
          slaChip: '1 day left',
        }
      ],
      total: 1,
      page: 1,
      limit: 10,
    })),
    updateReviewReport: jest.fn().mockImplementation((reportId, body, adminId) => Promise.resolve({
      id: reportId,
      status: body.status,
      actionTaken: body.actionTaken,
      adminNotes: body.adminNotes,
      resolvedBy: adminId,
      resolvedAt: new Date().toISOString(),
    })),
    createReview: jest.fn().mockResolvedValue({ id: 'rev-001' }),
    getAttorneyReviews: jest.fn().mockResolvedValue({ reviews: [], total: 0 }),
    submitRebuttal: jest.fn().mockResolvedValue({ id: 'rev-001', rebuttal: 'Addressed' }),
    updateModerationStatus: jest.fn().mockResolvedValue({ id: 'rev-001', moderationStatus: 'APPROVED' }),
  };

  const mockMessageService = {
    reportMessage: jest.fn().mockImplementation((messageId, body, userId) => Promise.resolve({
      id: 'msg-rep-001',
      messageId,
      reason: body.reason,
      status: 'PENDING',
      reportedBy: userId,
    })),
    getMessageReports: jest.fn().mockImplementation((query) => Promise.resolve({
      reports: [
        {
          id: 'msg-rep-001',
          messageId: 'msg-001',
          status: query?.status || 'PENDING',
          reason: 'Harassment in chat',
          slaHoursRemaining: 24,
          isOverdue: false,
          slaChip: '1 day left',
        }
      ],
      total: 1,
      page: 1,
      limit: 10,
    })),
    moderateMessage: jest.fn().mockImplementation((reportId, body, adminId) => Promise.resolve({
      id: reportId,
      status: body.status,
      actionTaken: body.actionTaken,
      adminNotes: body.adminNotes,
      resolvedBy: adminId,
      resolvedAt: new Date().toISOString(),
    })),
    sendMessage: jest.fn(),
    getConversationMessages: jest.fn(),
    editMessage: jest.fn(),
    deleteMessage: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DisputeController, ReviewController, MessageController],
      providers: [
        { provide: DisputeService, useValue: mockDisputeService },
        { provide: ReviewService, useValue: mockReviewService },
        { provide: MessageService, useValue: mockMessageService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'user-admin-123', email: 'admin@tebeka.et', roles: ['ADMIN', 'SUPER_ADMIN'] };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Dispute Endpoints (SCR-ADMIN-04 / FR-CASE-06 / FR-ADMIN-03)', () => {
    it('POST /cases/:id/dispute - should initiate a dispute for a legal case', async () => {
      const res = await request(app.getHttpServer())
        .post('/cases/case-999/dispute')
        .send({
          reason: 'Attorney failed to submit court document before deadline',
          evidenceUrls: ['https://storage.tebeka.et/evidence/doc1.pdf'],
        })
        .expect(201);

      expect(res.body.caseId).toBe('case-999');
      expect(res.body.status).toBe('OPEN');
      expect(res.body.slaDeadline).toBeDefined();
    });

    it('POST /bookings/:id/dispute - should initiate a dispute for a booking', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings/book-888/dispute')
        .send({
          reason: 'Attorney was a no-show for the scheduled video consultation',
        })
        .expect(201);

      expect(res.body.bookingId).toBe('book-888');
      expect(res.body.status).toBe('OPEN');
    });

    it('GET /disputes - should return list of disputes with SLA tracking chips', async () => {
      const res = await request(app.getHttpServer())
        .get('/disputes?status=OPEN&page=1&limit=10')
        .expect(200);

      expect(res.body.disputes).toHaveLength(1);
      expect(res.body.disputes[0].slaChip).toBe('5 days left');
    });

    it('GET /admin/disputes & GET /admin/queues/disputes - should return queue for admin', async () => {
      const res1 = await request(app.getHttpServer()).get('/admin/disputes').expect(200);
      const res2 = await request(app.getHttpServer()).get('/admin/queues/disputes').expect(200);

      expect(res1.body.disputes).toHaveLength(1);
      expect(res2.body.disputes).toHaveLength(1);
    });

    it('GET /disputes/:id - should return single dispute details with SLA status', async () => {
      const res = await request(app.getHttpServer())
        .get('/disputes/disp-book-001')
        .expect(200);

      expect(res.body.id).toBe('disp-book-001');
      expect(res.body.slaChip).toBe('2 days left');
    });

    it('PATCH /disputes/:id/resolve - should resolve dispute with chosen action', async () => {
      const res = await request(app.getHttpServer())
        .patch('/disputes/disp-book-001/resolve')
        .send({
          resolutionOutcome: 'REFUND_CLIENT',
          resolutionNotes: 'Verified that attorney did not show up. 100% refund approved.',
        })
        .expect(200);

      expect(res.body.status).toBe('RESOLVED');
      expect(res.body.resolutionOutcome).toBe('REFUND_CLIENT');
      expect(res.body.resolvedBy).toBe('user-admin-123');
    });
  });

  describe('2. Review Moderation Queue Endpoints (SCR-ADMIN-04)', () => {
    it('POST /reviews/:id/report - should report an abusive review', async () => {
      const res = await request(app.getHttpServer())
        .post('/reviews/rev-001/report')
        .send({ reason: 'Review contains defamatory language and hate speech' })
        .expect(201);

      expect(res.body.reviewId).toBe('rev-001');
      expect(res.body.status).toBe('PENDING');
    });

    it('GET /reviews/reports & GET /reviews/moderation-queue - should return review reports queue', async () => {
      const res1 = await request(app.getHttpServer()).get('/reviews/reports?status=PENDING').expect(200);
      const res2 = await request(app.getHttpServer()).get('/reviews/moderation-queue').expect(200);
      const res3 = await request(app.getHttpServer()).get('/admin/reviews/reports').expect(200);

      expect(res1.body.reports).toHaveLength(1);
      expect(res2.body.reports).toHaveLength(1);
      expect(res3.body.reports).toHaveLength(1);
      expect(res1.body.reports[0].slaChip).toBe('1 day left');
    });

    it('PATCH /reviews/reports/:reportId - should moderate and resolve review report', async () => {
      const res = await request(app.getHttpServer())
        .patch('/reviews/reports/rep-001')
        .send({
          status: 'ACTIONED',
          actionTaken: 'DELETE_CONTENT',
          adminNotes: 'Review violated community guidelines and was purged.',
        })
        .expect(200);

      expect(res.body.status).toBe('ACTIONED');
      expect(res.body.actionTaken).toBe('DELETE_CONTENT');
      expect(res.body.resolvedBy).toBe('user-admin-123');
    });
  });

  describe('3. Chat Moderation Queue Endpoints (SCR-ADMIN-04)', () => {
    it('POST /messages/:id/report & POST /chat/messages/:id/report - should submit chat message report', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/messages/msg-001/report')
        .send({
          reason: 'Harassment and extortion in private chat',
          category: 'HARASSMENT',
        })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/chat/messages/msg-001/report')
        .send({
          reason: 'Harassment and extortion in private chat',
          category: 'HARASSMENT',
        })
        .expect(201);

      expect(res1.body.messageId).toBe('msg-001');
      expect(res2.body.messageId).toBe('msg-001');
    });

    it('GET /messages/reports & GET /messages/moderation-queue - should return message moderation queue', async () => {
      const res1 = await request(app.getHttpServer()).get('/messages/reports?status=PENDING').expect(200);
      const res2 = await request(app.getHttpServer()).get('/messages/moderation-queue').expect(200);
      const res3 = await request(app.getHttpServer()).get('/admin/messages/reports').expect(200);

      expect(res1.body.reports).toHaveLength(1);
      expect(res2.body.reports).toHaveLength(1);
      expect(res3.body.reports).toHaveLength(1);
      expect(res1.body.reports[0].slaChip).toBe('1 day left');
    });

    it('PATCH /messages/reports/:reportId - should moderate reported chat message', async () => {
      const res = await request(app.getHttpServer())
        .patch('/messages/reports/msg-rep-001')
        .send({
          status: 'ACTIONED',
          actionTaken: 'DELETE_MESSAGE',
          adminNotes: 'Inappropriate message deleted from conversation history.',
        })
        .expect(200);

      expect(res.body.status).toBe('ACTIONED');
      expect(res.body.actionTaken).toBe('DELETE_MESSAGE');
      expect(res.body.resolvedBy).toBe('user-admin-123');
    });
  });
});
