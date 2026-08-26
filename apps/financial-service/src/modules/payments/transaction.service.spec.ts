import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './services/transaction.service';
import { PaymentStatus, PaymentProvider, PaymentType } from '@prisma/client/financial';

describe('TransactionService', () => {
  let service: TransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionService],
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
      expect(where.OR).toBeDefined();
      expect(where.OR.length).toBeGreaterThan(0);
    });

    it('should construct date range filters', () => {
      const startDate = '2026-01-01T00:00:00Z';
      const endDate = '2026-01-31T23:59:59Z';
      const where = (service as any).buildWhereClause({ startDate, endDate });

      expect(where.createdAt.gte).toEqual(new Date(startDate));
      expect(where.createdAt.lte).toEqual(new Date(endDate));
    });

    it('should construct amount range filters with minAmount and maxAmount', () => {
      const where = (service as any).buildWhereClause({
        minAmount: 500,
        maxAmount: 10000,
      });

      expect(where.amount.gte).toBe(500);
      expect(where.amount.lte).toBe(10000);
    });
  });
});
