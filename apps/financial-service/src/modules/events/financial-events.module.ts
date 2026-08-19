import { Module } from '@nestjs/common';
import { EventBusModule } from '@workspace/event-bus';
import { FinancialOutboxPublisherWorker } from './financial-outbox-publisher.worker';
import { FinancialEventsConsumer } from './financial-events.consumer';

@Module({
  imports: [EventBusModule],
  providers: [FinancialOutboxPublisherWorker, FinancialEventsConsumer],
  exports: [FinancialOutboxPublisherWorker, FinancialEventsConsumer],
})
export class FinancialEventsModule {}
