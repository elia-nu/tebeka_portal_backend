import { Module } from '@nestjs/common';
import { AppConfigModule } from '@workspace/config';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './webhook.controller';
import { PaymentService } from './payment.service';
import { PaymentRefundService } from './services/payment-refund.service';
import { PayoutWalletService } from './services/payout-wallet.service';
import { ChapaStrategy } from './strategies/chapa.strategy';
import { StripeStrategy } from './strategies/stripe.strategy';

import { GeoPaymentService } from './services/geo-payment.service';
import { TransactionService } from './services/transaction.service';
import { FinancialAnalyticsService } from './services/financial-analytics.service';

@Module({
  imports: [AppConfigModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    PaymentService,
    PaymentRefundService,
    PayoutWalletService,
    GeoPaymentService,
    TransactionService,
    FinancialAnalyticsService,
    ChapaStrategy,
    StripeStrategy,
  ],
  exports: [
    PaymentService,
    PaymentRefundService,
    PayoutWalletService,
    GeoPaymentService,
    TransactionService,
    FinancialAnalyticsService,
    ChapaStrategy,
    StripeStrategy,
  ],
})
export class PaymentModule {}
