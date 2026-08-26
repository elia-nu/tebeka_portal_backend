import { Test, TestingModule } from '@nestjs/testing';
import { GeoPaymentService } from './services/geo-payment.service';

describe('GeoPaymentService', () => {
  let service: GeoPaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeoPaymentService],
    }).compile();

    service = module.get<GeoPaymentService>(GeoPaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect Ethiopian IP and return CHAPA with ETB currency', () => {
    // 196.188.1.1 is allocated to Ethio Telecom (Ethiopia)
    const result = service.resolveGateway('196.188.1.1');
    expect(result.country).toBe('ET');
    expect(result.provider).toBe('CHAPA');
    expect(result.currency).toBe('ETB');
    expect(result.isDomestic).toBe(true);
    expect(result.availableProviders).toContain('CHAPA');
    expect(result.availableProviders).toContain('TELEBIRR');
  });

  it('should detect US IP and return STRIPE with USD currency', () => {
    // 8.8.8.8 is Google DNS (US)
    const result = service.resolveGateway('8.8.8.8');
    expect(result.country).toBe('US');
    expect(result.provider).toBe('STRIPE');
    expect(result.currency).toBe('USD');
    expect(result.isDomestic).toBe(false);
    expect(result.availableProviders).toEqual(['STRIPE']);
  });

  it('should detect UK IP and return STRIPE with USD currency', () => {
    // 212.58.244.20 is BBC (GB)
    const result = service.resolveGateway('212.58.244.20');
    expect(result.country).toBe('GB');
    expect(result.provider).toBe('STRIPE');
    expect(result.currency).toBe('USD');
    expect(result.isDomestic).toBe(false);
  });

  it('should respect manual overrideCountry if provided', () => {
    const etResult = service.resolveGateway('8.8.8.8', 'ET');
    expect(etResult.provider).toBe('CHAPA');
    expect(etResult.currency).toBe('ETB');
    expect(etResult.isDomestic).toBe(true);

    const usResult = service.resolveGateway('196.188.1.1', 'US');
    expect(usResult.provider).toBe('STRIPE');
    expect(usResult.currency).toBe('USD');
    expect(usResult.isDomestic).toBe(false);
  });

  it('should extract client IP from X-Forwarded-For header', () => {
    const req = {
      headers: {
        'x-forwarded-for': '196.188.1.1, 10.0.0.1',
      },
    };
    const ip = service.extractClientIp(req);
    expect(ip).toBe('196.188.1.1');
  });

  it('should extract client IP from Cloudflare CF-Connecting-IP header', () => {
    const req = {
      headers: {
        'cf-connecting-ip': '8.8.8.8',
      },
    };
    const ip = service.extractClientIp(req);
    expect(ip).toBe('8.8.8.8');
  });
});
