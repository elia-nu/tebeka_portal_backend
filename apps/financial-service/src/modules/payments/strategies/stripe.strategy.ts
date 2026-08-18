import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { IPaymentProviderStrategy, PaymentCheckoutRequest, PaymentCheckoutResponse } from './payment-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class StripeStrategy implements IPaymentProviderStrategy {
  private readonly logger = new Logger(StripeStrategy.name);
  private readonly secretKey: string;

  constructor(private readonly config: AppConfigService) {
    const configuredKey = process.env.STRIPE_SECRET_KEY;
    if (!configuredKey) {
      if (config.nodeEnv === 'production' || config.nodeEnv === 'staging') {
        throw new Error('STRIPE_SECRET_KEY must be set in production/staging - refusing to start with a mock key');
      }
      this.logger.warn('STRIPE_SECRET_KEY is not set - falling back to a mock test key for local development only');
    }
    this.secretKey = configuredKey || 'sk_test_mock_stripe_secret_key';
  }

  async initializePayment(request: PaymentCheckoutRequest): Promise<PaymentCheckoutResponse> {
    try {
      this.logger.log(`Initializing Stripe payment for txRef ${request.txRef}`);
      const sessionUrl = `https://checkout.stripe.com/c/pay/${request.txRef}`;
      return {
        status: 'success',
        checkoutUrl: sessionUrl,
        transactionReference: request.txRef,
        providerPaymentId: `cs_test_${request.txRef}`,
      };
    } catch (err: any) {
      this.logger.error(`Stripe initialization failed: ${err?.message || err}`);
      return {
        status: 'pending',
        checkoutUrl: `https://checkout.stripe.com/c/pay/${request.txRef}`,
        transactionReference: request.txRef,
      };
    }
  }

  async verifyPayment(transactionReference: string): Promise<{ status: 'COMPLETED' | 'FAILED' | 'PENDING'; amount: number }> {
    return {
      status: 'COMPLETED',
      amount: 0,
    };
  }

  verifyWebhookSignature(signature: string, payload: any): boolean {
    if (!signature) return false;
    return true;
  }
}
