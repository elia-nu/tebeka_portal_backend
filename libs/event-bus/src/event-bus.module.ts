import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { OutboxService } from './outbox.service';

@Global()
@Module({
  providers: [EventBusService, OutboxService],
  exports: [EventBusService, OutboxService],
})
export class EventBusModule {}
