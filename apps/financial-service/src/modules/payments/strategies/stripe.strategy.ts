import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { IPaymentProviderStrategy, PaymentCheckoutRequest, PaymentCheckoutResponse } from './payment-provider.interface';
import Stripe from 'stripe';

@Injectable()
export class StripeStrategy implements IPaymentProviderStrategy {
  private readonly logger = new Logger(StripeStrategy.name);
  private readonly stripe: Stripe | null = null;
  private readonly secretKey: string;
  private readonly webhookSecret: string;
  private readonly isMockMode: boolean = false;

  constructor(private readonly config: AppConfigService) {
    const configuredKey = process.env.STRIPE_SECRET || process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    if (!configuredKey) {
      const env = process.env.NODE_ENV || this.config?.nodeEnv;
      if (env === 'production' || env === 'staging') {
        throw new Error('STRIPE_SECRET_KEY must be set in production/staging - refusing to start with a mock key');
      }
      this.logger.warn('STRIPE_SECRET_KEY is not set - running Stripe in mock development mode');
      this.secretKey = 'sk_test_mock_stripe_key';
      this.isMockMode = true;
    } else {
      this.secretKey = configuredKey;
      this.stripe = new Stripe(this.secretKey, {
        apiVersion: '2024-12-18.acacia' as any,
      });
      this.isMockMode = false;
    }
  }

  /**
   * Creates a Stripe Connect Express Account for an Attorney.
   */
  async createConnectAccount(data: {
    attorneyId: string;
    email: string;
    country?: string;
    businessName?: string;
  }): Promise<{ accountId: string; message: string }> {
    if (this.isMockMode || !this.stripe) {
      const mockAccountId = `acct_mock_${data.attorneyId}_${Date.now()}`;
      this.logger.log(`[MOCK] Created Stripe Connect account for attorney ${data.attorneyId}: ${mockAccountId}`);
      return {
        accountId: mockAccountId,
        message: 'Mock Stripe Connect account created',
      };
    }

    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        country: data.country || 'US',
        email: data.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: data.businessName || `Attorney ${data.attorneyId}`,
          product_description: 'Legal representation and consultation services',
        },
        metadata: {
          attorneyId: data.attorneyId,
        },
      });

      return {
        accountId: account.id,
        message: 'Stripe Connect Express account created successfully',
      };
    } catch (err: any) {
      this.logger.warn(`Stripe live Connect account creation warning: ${err.message}`);
      const env = process.env.NODE_ENV || this.config?.nodeEnv;
      if (env === 'production') {
        throw new BadRequestException(`Failed to create Stripe Connect account: ${err.message}`);
      }
      return {
        accountId: `acct_dev_${data.attorneyId}`,
        message: `Stripe Connect setup note: ${err.message}`,
      };
    }
  }

  /**
   * Generates a Stripe Connect Account Onboarding Link.
   */
  async createAccountLink(accountId: string, returnUrl?: string, refreshUrl?: string): Promise<string> {
    if (this.isMockMode || !this.stripe || accountId.startsWith('acct_dev_') || accountId.startsWith('acct_mock_')) {
      return `https://connect.stripe.com/setup/s/dev_${accountId}`;
    }

    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl || 'https://tebeka.et/attorney/payout-setup?refresh=true',
        return_url: returnUrl || 'https://tebeka.et/attorney/payout-setup?success=true',
        type: 'account_onboarding',
      });
      return accountLink.url;
    } catch (err: any) {
      this.logger.warn(`Stripe account link creation note: ${err.message}`);
      return `https://connect.stripe.com/setup/s/dev_${accountId}`;
    }
  }

  /**
   * Initializes a Stripe Checkout Session with Split Payment (Destination Charge & Application Fee).
   */
  async initializePayment(request: PaymentCheckoutRequest): Promise<PaymentCheckoutResponse> {
    const currency = (request.currency || 'USD').toLowerCase();
    const amountInCents = Math.round(Number(request.amount) * 100);
    const targetAccountId = request.stripeAccountId || request.subaccountId;

    // Platform Commission (set by Admin) in cents
    const commissionAmount = request.commission ? Number(request.commission) : (Number(request.amount) * (request.splitPercentage || 15)) / 100;
    const commissionInCents = Math.round(commissionAmount * 100);

    if (this.isMockMode || !this.stripe) {
      this.logger.log(`[MOCK] Initializing Stripe Checkout session for txRef ${request.txRef} (Amount: ${request.amount} ${currency.toUpperCase()}, Commission: ${commissionAmount})`);
      return {
        status: 'success',
        checkoutUrl: `https://checkout.stripe.com/c/pay/${request.txRef}`,
        transactionReference: request.txRef,
        providerPaymentId: `cs_test_${request.txRef}`,
        rawResponse: {
          mock: true,
          amount: request.amount,
          currency,
          applicationFee: commissionAmount,
          destinationAccount: targetAccountId,
        },
      };
    }

    try {
      this.logger.log(
        `Initializing live Stripe Checkout for ${request.txRef}: amount=${request.amount} ${currency.toUpperCase()}, applicationFee=${commissionAmount}, destination=${targetAccountId}`
      );

      const paymentIntentData: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {
        metadata: {
          txRef: request.txRef,
          paymentId: request.paymentId,
        },
      };

      // Split Payment: route destination to attorney account while deducting platform fee
      const isLiveConnectAccount =
        targetAccountId &&
        targetAccountId.startsWith('acct_') &&
        !targetAccountId.startsWith('acct_dev_') &&
        !targetAccountId.startsWith('acct_mock_') &&
        !targetAccountId.startsWith('acct_test_') &&
        !targetAccountId.startsWith('acct_attorney_');

      if (isLiveConnectAccount) {
        paymentIntentData.application_fee_amount = commissionInCents;
        paymentIntentData.transfer_data = {
          destination: targetAccountId,
        };
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: 'Tebeka Legal Services',
                description: `Payment for reference ${request.txRef}`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: Object.keys(paymentIntentData).length > 0 ? paymentIntentData : undefined,
        client_reference_id: request.txRef,
        customer_email: request.email || undefined,
        success_url: request.returnUrl || `https://tebeka.et/payment/success?session_id={CHECKOUT_SESSION_ID}&tx_ref=${request.txRef}`,
        cancel_url: request.callbackUrl || `https://tebeka.et/payment/cancel?tx_ref=${request.txRef}`,
        metadata: {
          txRef: request.txRef,
          paymentId: request.paymentId,
        },
      });

      return {
        status: 'success',
        checkoutUrl: session.url || `https://checkout.stripe.com/c/pay/${request.txRef}`,
        transactionReference: request.txRef,
        providerPaymentId: session.id,
        rawResponse: session,
      };
    } catch (err: any) {
      this.logger.error(`Stripe initialization failed: ${err?.message || err}`);
      throw new BadRequestException(err?.message || `Stripe payment initialization failed for ${request.txRef}`);
    }
  }

  async verifyPayment(transactionReference: string): Promise<{ status: 'COMPLETED' | 'FAILED' | 'PENDING'; amount: number }> {
    if (this.isMockMode || !this.stripe) {
      return { status: 'COMPLETED', amount: 0 };
    }

    try {
      if (transactionReference.startsWith('cs_')) {
        const session = await this.stripe.checkout.sessions.retrieve(transactionReference);
        if (session && session.payment_status === 'paid') {
          return {
            status: 'COMPLETED',
            amount: (session.amount_total || 0) / 100,
          };
        }
        return { status: 'PENDING', amount: (session.amount_total || 0) / 100 };
      }

      if (transactionReference.startsWith('pi_')) {
        const intent = await this.stripe.paymentIntents.retrieve(transactionReference);
        if (intent && intent.status === 'succeeded') {
          return {
            status: 'COMPLETED',
            amount: (intent.amount_received || intent.amount || 0) / 100,
          };
        }
        return { status: 'PENDING', amount: (intent.amount || 0) / 100 };
      }

      const sessions = await this.stripe.checkout.sessions.list({ limit: 10 });
      const matched = sessions.data.find(
        (s) => s.client_reference_id === transactionReference || s.metadata?.txRef === transactionReference
      );
      if (matched && matched.payment_status === 'paid') {
        return {
          status: 'COMPLETED',
          amount: (matched.amount_total || 0) / 100,
        };
      }

      return { status: 'PENDING', amount: 0 };
    } catch (err: any) {
      this.logger.error(`Stripe verify failed: ${err.message}`);
      return { status: 'FAILED', amount: 0 };
    }
  }

  /**
   * Constructs and verifies a Stripe Event from webhook signature and raw body.
   */
  constructEvent(signature: string, payload: any, rawBody?: Buffer | string): Stripe.Event | null {
    if (this.isMockMode || !this.webhookSecret || !this.stripe) {
      // In mock mode or dev without secret, parse payload safely
      return typeof payload === 'string' ? JSON.parse(payload) : payload;
    }

    if (!signature) {
      this.logger.warn('Stripe webhook received without stripe-signature header');
      return null;
    }

    try {
      const raw = rawBody
        ? rawBody
        : (typeof payload === 'string' ? payload : JSON.stringify(payload));

      return this.stripe.webhooks.constructEvent(raw, signature, this.webhookSecret);
    } catch (err: any) {
      this.logger.warn(`Stripe webhook signature validation failed: ${err.message}`);
      return null;
    }
  }

  verifyWebhookSignature(signature: string, payload: any, rawBody?: Buffer | string): boolean {
    if (!signature) {
      return this.isMockMode || !this.webhookSecret || !this.stripe;
    }
    if (this.isMockMode || !this.webhookSecret || !this.stripe) return true;

    try {
      const raw = rawBody
        ? rawBody
        : (typeof payload === 'string' ? payload : JSON.stringify(payload));

      this.stripe.webhooks.constructEvent(raw, signature, this.webhookSecret);
      return true;
    } catch (err: any) {
      this.logger.warn(`Stripe webhook signature validation failed: ${err.message}`);
      return false;
    }
  }
}
