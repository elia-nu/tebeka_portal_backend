import { Module } from '@nestjs/common';
import { EventBusModule } from '@workspace/event-bus';
import { FinancialOutboxPublisherWorker } from './financial-outbox-publisher.worker';
import { FinancialEventsConsumer } from './financial-events.consumer';
import { PaymentModule } from '../payments/payment.module';

@Module({
  imports: [EventBusModule, PaymentModule],
  providers: [FinancialOutboxPublisherWorker, FinancialEventsConsumer],
  exports: [FinancialOutboxPublisherWorker, FinancialEventsConsumer],
})
export class FinancialEventsModule {}
