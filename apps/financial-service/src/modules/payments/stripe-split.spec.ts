import { Test, TestingModule } from '@nestjs/testing';
import { StripeStrategy } from './strategies/stripe.strategy';
import { AppConfigService } from '@workspace/config';

describe('StripeStrategy Split Payments', () => {
  let strategy: StripeStrategy;

  beforeEach(async () => {
    const mockConfigService = {
      nodeEnv: 'test',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeStrategy,
        { provide: AppConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<StripeStrategy>(StripeStrategy);
  });

  it('should create Stripe Connect account for attorney', async () => {
    const res = await strategy.createConnectAccount({
      attorneyId: 'attorney_123',
      email: 'attorney@example.com',
      country: 'US',
    });

    expect(res.accountId).toBeDefined();
    expect(res.accountId).toContain('attorney_123');
  });

  it('should generate account onboarding link', async () => {
    const link = await strategy.createAccountLink('acct_test_123');
    expect(link).toBeDefined();
    expect(typeof link).toBe('string');
  });

  it('should initialize split payment with destination charge and application fee', async () => {
    const checkout = await strategy.initializePayment({
      paymentId: 'pay-uuid-1',
      amount: 100,
      currency: 'USD',
      email: 'client@example.com',
      txRef: 'TX-TEST-STRIPE-SPLIT-1',
      stripeAccountId: 'acct_attorney_destination',
      commission: 15, // 15% platform commission set by admin
      splitPercentage: 15,
    });

    expect(checkout.status).toBe('success');
    expect(checkout.checkoutUrl).toBeDefined();
    expect(checkout.transactionReference).toBe('TX-TEST-STRIPE-SPLIT-1');
  });
});
