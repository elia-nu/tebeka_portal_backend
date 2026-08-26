import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

@Controller('payments/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly chapaStrategy: ChapaStrategy,
    private readonly stripeStrategy: StripeStrategy,
  ) {}

  @Post('chapa')
  @HttpCode(HttpStatus.OK)
  async handleChapaWebhook(@Body() body: any, @Headers('x-chapa-signature') signature: string) {
    this.logger.log(`Received Chapa Webhook: ${JSON.stringify(body)}`);

    const isValid = this.chapaStrategy.verifyWebhookSignature(signature, body);
    if (!isValid && process.env.NODE_ENV === 'production') {
      this.logger.warn('Invalid Chapa webhook signature');
      return { status: 'ignored', reason: 'Invalid signature' };
    }

    const txRef = body?.tx_ref || body?.trx_ref;
    const status = body?.status;

    if (txRef && status === 'success') {
      await this.paymentService.markPaymentCompletedByReference(txRef, body);
      return { status: 'success', message: 'Payment reference marked as COMPLETED' };
    }

    return { status: 'acknowledged' };
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(@Body() body: any, @Headers('stripe-signature') signature: string) {
    this.logger.log(`Received Stripe Webhook event: ${body?.type}`);

    const isValid = this.stripeStrategy.verifyWebhookSignature(signature, body);
    if (!isValid && process.env.NODE_ENV === 'production') {
      return { status: 'ignored', reason: 'Invalid signature' };
    }

    if (body?.type === 'checkout.session.completed') {
      const session = body?.data?.object;
      const txRef = session?.client_reference_id || session?.metadata?.txRef;
      if (txRef) {
        await this.paymentService.markPaymentCompletedByReference(txRef, session);
        return { status: 'success', message: 'Payment reference marked as COMPLETED' };
      }
    } else if (body?.type === 'payment_intent.succeeded') {
      const intent = body?.data?.object;
      const txRef = intent?.metadata?.txRef;
      if (txRef) {
        await this.paymentService.markPaymentCompletedByReference(txRef, intent);
        return { status: 'success', message: 'Payment reference marked as COMPLETED' };
      }
    }

    return { status: 'acknowledged' };
  }
}
