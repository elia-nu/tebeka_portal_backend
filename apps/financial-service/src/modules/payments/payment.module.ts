import { Module } from '@nestjs/common';
import { AppConfigModule } from '@workspace/config';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

@Module({
  imports: [AppConfigModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService, ChapaStrategy, StripeStrategy],
  exports: [PaymentService, ChapaStrategy, StripeStrategy],
})
export class PaymentModule {}

