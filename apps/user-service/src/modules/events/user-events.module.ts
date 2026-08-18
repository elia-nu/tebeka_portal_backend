import { Module } from '@nestjs/common';
import { EventBusModule } from '@workspace/event-bus';
import { UserOutboxPublisherWorker } from './user-outbox-publisher.worker';

@Module({
  imports: [EventBusModule],
  providers: [UserOutboxPublisherWorker],
  exports: [UserOutboxPublisherWorker],
})
export class UserEventsModule {}
