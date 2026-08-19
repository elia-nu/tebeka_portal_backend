import { Module } from '@nestjs/common';
import { EventBusModule } from '@workspace/event-bus';
import { OutboxPublisherWorker } from './outbox-publisher.worker';
import { MarketplaceEventsConsumer } from './marketplace-events.consumer';
import { GoogleMeetService } from '../integrations/google-meet.service';

@Module({
  imports: [EventBusModule],
  providers: [OutboxPublisherWorker, MarketplaceEventsConsumer, GoogleMeetService],
  exports: [OutboxPublisherWorker, MarketplaceEventsConsumer, GoogleMeetService],
})
export class EventsModule {}
