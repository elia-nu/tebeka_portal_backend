import { Module } from '@nestjs/common';
import { EventBusModule } from '@workspace/event-bus';
import { OutboxPublisherWorker } from './outbox-publisher.worker';
import { MarketplaceEventsConsumer } from './marketplace-events.consumer';

@Module({
  imports: [EventBusModule],
  providers: [OutboxPublisherWorker, MarketplaceEventsConsumer],
  exports: [OutboxPublisherWorker, MarketplaceEventsConsumer],
})
export class EventsModule {}
