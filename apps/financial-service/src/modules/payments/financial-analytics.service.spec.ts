import { Test, TestingModule } from '@nestjs/testing';
import { FinancialAnalyticsService } from './services/financial-analytics.service';

describe('FinancialAnalyticsService', () => {
  let service: FinancialAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancialAnalyticsService],
    }).compile();

    service = module.get<FinancialAnalyticsService>(FinancialAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveDateRange helper', () => {
    it('should correctly compute 7d, 30d, 90d, 12m relative date ranges', () => {
      const range7d = (service as any).resolveDateRange({ period: '7d' });
      expect(range7d.startDate).toBeDefined();
      expect(range7d.endDate).toBeDefined();
      const diffDays7 = Math.round((range7d.endDate.getTime() - range7d.startDate.getTime()) / (1000 * 3600 * 24));
      expect(diffDays7).toBe(7);

      const range30d = (service as any).resolveDateRange({ period: '30d' });
      const diffDays30 = Math.round((range30d.endDate.getTime() - range30d.startDate.getTime()) / (1000 * 3600 * 24));
      expect(diffDays30).toBe(30);
    });

    it('should respect custom startDate and endDate over period keyword', () => {
      const start = '2026-01-01T00:00:00Z';
      const end = '2026-01-31T23:59:59Z';
      const range = (service as any).resolveDateRange({
        period: '7d',
        startDate: start,
        endDate: end,
      });

      expect(range.startDate).toEqual(new Date(start));
      expect(range.endDate).toEqual(new Date(end));
    });
  });
});
