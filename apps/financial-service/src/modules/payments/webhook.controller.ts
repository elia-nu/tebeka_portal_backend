import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { Public } from '@workspace/auth';
import { PaymentService } from './payment.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';
import { processChapaWebhookEvent } from './utils/webhook-chapa.util';
import { processStripeWebhookEvent } from './utils/webhook-stripe.util';

@Public()
@Controller('payments/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly chapaStrategy: ChapaStrategy,
    private readonly stripeStrategy: StripeStrategy
  ) {}

  /**
   * Webhook Configuration & Health Status
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async getWebhookHealth() {
    return {
      status: 'ok',
      service: 'financial-service',
      webhooks: {
        chapa: {
          endpoint: '/api/v1/payments/webhooks/chapa',
          methods: ['GET', 'POST'],
          configured: !!(process.env.CHAPA_SECRET || process.env.CHAPA_SECRET_KEY),
        },
        stripe: {
          endpoint: '/api/v1/payments/webhooks/stripe',
          methods: ['POST'],
          configured: !!(process.env.STRIPE_SECRET || process.env.STRIPE_SECRET_KEY),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Chapa Payment Webhook Handler (POST)
   */
  @Post('chapa')
  @HttpCode(HttpStatus.OK)
  async handleChapaWebhookPost(
    @Body() body: any,
    @Headers('x-chapa-signature') rawSig: string,
    @Req() req: any
  ) {
    return processChapaWebhookEvent(
      this.paymentService,
      this.chapaStrategy,
      body,
      rawSig,
      req,
      this.logger
    );
  }

  /**
   * Backward-compatible alias for unit testing & direct invokers
   */
  async handleChapaWebhook(body: any, rawSig: string, req: any) {
    return this.handleChapaWebhookPost(body, rawSig, req);
  }

  /**
   * Chapa Payment Callback / Redirect Handler (GET)
   */
  @Get('chapa')
  @HttpCode(HttpStatus.OK)
  async handleChapaWebhookGet(
    @Headers('x-chapa-signature') rawSig: string,
    @Req() req: any
  ) {
    return processChapaWebhookEvent(
      this.paymentService,
      this.chapaStrategy,
      null,
      rawSig,
      req,
      this.logger
    );
  }

  /**
   * Stripe Webhook Handler
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Body() body: any,
    @Headers('stripe-signature') signature: string,
    @Req() req: any
  ) {
    return processStripeWebhookEvent(
      this.paymentService,
      this.stripeStrategy,
      body,
      signature,
      req,
      this.logger
    );
  }
}
