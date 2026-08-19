import { Module } from '@nestjs/common';
import { AppConfigModule } from '@workspace/config';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { PaymentRefundService } from './services/payment-refund.service';
import { PayoutWalletService } from './services/payout-wallet.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

@Module({
  imports: [AppConfigModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    PaymentService,
    PaymentRefundService,
    PayoutWalletService,
    ChapaStrategy,
    StripeStrategy,
  ],
  exports: [
    PaymentService,
    PaymentRefundService,
    PayoutWalletService,
    ChapaStrategy,
    StripeStrategy,
  ],
})
export class PaymentModule {}
