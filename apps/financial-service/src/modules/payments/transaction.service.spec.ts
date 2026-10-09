import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './services/transaction.service';
import { PaymentStatus, PaymentProvider, PaymentType } from '@prisma/client/financial';
import { PrismaService } from '../../database/prisma.service';

describe('TransactionService', () => {
  let service: TransactionService;
  const mockPrismaService = {
    payment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('formatTransaction helper', () => {
    it('should correctly format transaction with netAmount and commission calculations', () => {
      const rawTx = {
        id: 'tx-1',
        transactionReference: 'TX-REF-100',
        payerId: 'client-1',
        payeeId: 'attorney-1',
        paymentType: PaymentType.CONSULTATION_ONE_TIME,
        amount: 2000,
        currency: 'ETB',
        commission: 300,
        provider: PaymentProvider.CHAPA,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const formatted = (service as any).formatTransaction(rawTx);
      expect(formatted.id).toBe('tx-1');
      expect(formatted.amount).toBe(2000);
      expect(formatted.commission).toBe(300);
      expect(formatted.netAmount).toBe(1700); // 2000 - 300
    });
  });

  describe('buildWhereClause helper', () => {
    it('should construct case-insensitive search queries across multiple fields', () => {
      const where = (service as any).buildWhereClause({
        search: 'CASE-123',
        status: PaymentStatus.COMPLETED,
        currency: 'USD',
      });

      expect(where.status).toBe(PaymentStatus.COMPLETED);
      expect(where.currency).toBe('USD');
      expect(where.AND).toBeDefined();
      expect(where.AND[0].OR.length).toBeGreaterThan(0);
    });

    it('should construct multi-status and multi-provider queries', () => {
      const where = (service as any).buildWhereClause({
        statuses: 'COMPLETED,PENDING',
        providers: 'CHAPA,TELEBIRR',
      });

      expect(where.status).toEqual({ in: [PaymentStatus.COMPLETED, PaymentStatus.PENDING] });
      expect(where.provider).toEqual({ in: [PaymentProvider.CHAPA, PaymentProvider.TELEBIRR] });
    });

    it('should handle category and paymentType filtering', () => {
      const whereCase = (service as any).buildWhereClause({ category: 'CASE' });
      expect(whereCase.paymentType.in).toContain(PaymentType.CASE_MILESTONE);
      expect(whereCase.paymentType.in).toContain(PaymentType.CASE_PERCENTAGE);

      const whereConsult = (service as any).buildWhereClause({ category: 'CONSULTATION' });
      expect(whereConsult.paymentType).toBe(PaymentType.CONSULTATION_ONE_TIME);
    });

    it('should construct party, user, and reference filters', () => {
      const where = (service as any).buildWhereClause({
        userId: 'user-999',
        reference: 'TX-REF-888',
        stage: 'Initial Discovery',
        milestoneName: 'Brief Filing',
      });

      expect(where.transactionReference.contains).toBe('TX-REF-888');
      expect(where.stage.contains).toBe('Initial Discovery');
      expect(where.milestoneName.contains).toBe('Brief Filing');
      expect(where.AND).toBeDefined();
    });

    it('should construct commission, paidAt, and escrow filters', () => {
      const where = (service as any).buildWhereClause({
        minCommission: 50,
        maxCommission: 500,
        paidStartDate: '2026-02-01T00:00:00Z',
        paidEndDate: '2026-02-28T23:59:59Z',
        isEscrowReleased: 'true',
        hasRefund: 'false',
      });

      expect(where.commission.gte).toBe(50);
      expect(where.commission.lte).toBe(500);
      expect(where.paidAt.gte).toEqual(new Date('2026-02-01T00:00:00Z'));
      expect(where.paidAt.lte).toEqual(new Date('2026-02-28T23:59:59Z'));
      expect(where.escrowReleasedAt).toEqual({ not: null });
      expect(where.refunds).toEqual({ none: {} });
    });
  });

  describe('sorting helpers', () => {
    it('should resolve sort fields and sort order safely', () => {
      expect(service.getSortBy({ sortBy: 'amount' })).toBe('amount');
      expect(service.getSortBy({ sortBy: 'invalidField' })).toBe('createdAt');
      expect(service.getSortOrder({ sortOrder: 'asc' })).toBe('asc');
      expect(service.getSortOrder({ sortOrder: 'DESC' as any })).toBe('desc');
    });
  });
});
