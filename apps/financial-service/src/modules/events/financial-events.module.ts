import { Module } from '@nestjs/common';
import { EventBusModule } from '@workspace/event-bus';
import { FinancialOutboxPublisherWorker } from './financial-outbox-publisher.worker';

@Module({
  imports: [EventBusModule],
  providers: [FinancialOutboxPublisherWorker],
  exports: [FinancialOutboxPublisherWorker],
})
export class FinancialEventsModule {}
