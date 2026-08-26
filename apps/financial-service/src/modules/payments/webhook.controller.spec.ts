import { Test, TestingModule } from '@nestjs/testing';
import { PaymentWebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

describe('PaymentWebhookController', () => {
  let controller: PaymentWebhookController;
  let paymentService: jest.Mocked<PaymentService>;
  let chapaStrategy: jest.Mocked<ChapaStrategy>;
  let stripeStrategy: jest.Mocked<StripeStrategy>;

  beforeEach(async () => {
    const mockPaymentService = {
      markPaymentCompletedByReference: jest.fn(),
      markPaymentFailedByReference: jest.fn(),
    };

    const mockChapaStrategy = {
      verifyWebhookSignature: jest.fn(),
    };

    const mockStripeStrategy = {
      verifyWebhookSignature: jest.fn(),
      constructEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentWebhookController],
      providers: [
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: ChapaStrategy, useValue: mockChapaStrategy },
        { provide: StripeStrategy, useValue: mockStripeStrategy },
      ],
    }).compile();

    controller = module.get<PaymentWebhookController>(PaymentWebhookController);
    paymentService = module.get(PaymentService);
    chapaStrategy = module.get(ChapaStrategy);
    stripeStrategy = module.get(StripeStrategy);
  });

  describe('Chapa Webhooks', () => {
    it('should successfully handle Chapa successful payment callback', async () => {
      chapaStrategy.verifyWebhookSignature.mockReturnValue(true);
      paymentService.markPaymentCompletedByReference.mockResolvedValue({ id: 'pay-123' } as any);

      const body = {
        tx_ref: 'TX-12345',
        status: 'success',
        amount: 5000,
        currency: 'ETB',
      };

      const result = await controller.handleChapaWebhook(body, 'valid-sig', { rawBody: Buffer.from('raw') });

      expect(chapaStrategy.verifyWebhookSignature).toHaveBeenCalledWith('valid-sig', body, expect.any(Buffer));
      expect(paymentService.markPaymentCompletedByReference).toHaveBeenCalledWith('TX-12345', body);
      expect(result).toEqual({
        status: 'success',
        message: 'Payment marked as COMPLETED',
        paymentId: 'pay-123',
        reference: 'TX-12345',
      });
    });

    it('should successfully handle Chapa failed payment callback', async () => {
      chapaStrategy.verifyWebhookSignature.mockReturnValue(true);
      paymentService.markPaymentFailedByReference.mockResolvedValue({ id: 'pay-123' } as any);

      const body = {
        tx_ref: 'TX-FAILED-1',
        status: 'failed',
        message: 'Insufficient balance',
      };

      const result = await controller.handleChapaWebhook(body, 'valid-sig', {});

      expect(paymentService.markPaymentFailedByReference).toHaveBeenCalledWith('TX-FAILED-1', 'Insufficient balance', body);
      expect(result).toEqual({
        status: 'failed',
        message: 'Payment marked as FAILED',
        paymentId: 'pay-123',
        reference: 'TX-FAILED-1',
      });
    });

    it('should reject or ignore invalid signature in production', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      chapaStrategy.verifyWebhookSignature.mockReturnValue(false);

      const result = await controller.handleChapaWebhook({ tx_ref: 'TX-1' }, 'bad-sig', {});

      expect(result).toEqual({ status: 'ignored', reason: 'Invalid signature' });
      expect(paymentService.markPaymentCompletedByReference).not.toHaveBeenCalled();

      process.env.NODE_ENV = origEnv;
    });
  });

  describe('Stripe Webhooks', () => {
    it('should handle checkout.session.completed event', async () => {
      const sessionData = {
        client_reference_id: 'TX-STRIPE-1',
        payment_status: 'paid',
        id: 'cs_test_123',
      };

      stripeStrategy.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: sessionData },
      } as any);

      paymentService.markPaymentCompletedByReference.mockResolvedValue({ id: 'pay-456' } as any);

      const result = await controller.handleStripeWebhook({}, 'stripe-sig', { rawBody: Buffer.from('raw') });

      expect(paymentService.markPaymentCompletedByReference).toHaveBeenCalledWith('TX-STRIPE-1', sessionData);
      expect(result).toEqual({
        status: 'success',
        message: 'Payment marked as COMPLETED via Checkout Session',
        paymentId: 'pay-456',
        reference: 'TX-STRIPE-1',
      });
    });

    it('should handle payment_intent.succeeded event', async () => {
      const intentData = {
        id: 'pi_test_123',
        metadata: { txRef: 'TX-INTENT-1' },
      };

      stripeStrategy.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: intentData },
      } as any);

      paymentService.markPaymentCompletedByReference.mockResolvedValue({ id: 'pay-789' } as any);

      const result = await controller.handleStripeWebhook({}, 'stripe-sig', {});

      expect(paymentService.markPaymentCompletedByReference).toHaveBeenCalledWith('TX-INTENT-1', intentData);
      expect(result).toEqual({
        status: 'success',
        message: 'Payment marked as COMPLETED via PaymentIntent',
        paymentId: 'pay-789',
        reference: 'TX-INTENT-1',
      });
    });

    it('should handle payment_intent.payment_failed event', async () => {
      const intentData = {
        id: 'pi_test_fail',
        metadata: { txRef: 'TX-INTENT-FAIL' },
        last_payment_error: { message: 'Card declined' },
      };

      stripeStrategy.constructEvent.mockReturnValue({
        type: 'payment_intent.payment_failed',
        data: { object: intentData },
      } as any);

      paymentService.markPaymentFailedByReference.mockResolvedValue({ id: 'pay-999' } as any);

      const result = await controller.handleStripeWebhook({}, 'stripe-sig', {});

      expect(paymentService.markPaymentFailedByReference).toHaveBeenCalledWith('TX-INTENT-FAIL', 'Card declined', intentData);
      expect(result).toEqual({
        status: 'failed',
        message: 'Payment marked as FAILED via PaymentIntent',
        paymentId: 'pay-999',
        reference: 'TX-INTENT-FAIL',
      });
    });

    it('should handle account.updated event for connected attorney express onboarding', async () => {
      const accountData = {
        id: 'acct_123',
        charges_enabled: true,
        details_submitted: true,
      };

      stripeStrategy.constructEvent.mockReturnValue({
        type: 'account.updated',
        data: { object: accountData },
      } as any);

      const result = await controller.handleStripeWebhook({}, 'stripe-sig', {});

      expect(result).toEqual({
        status: 'acknowledged',
        event: 'account.updated',
        accountId: 'acct_123',
      });
    });
  });
});
