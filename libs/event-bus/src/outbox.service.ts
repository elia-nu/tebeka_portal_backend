import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from './event-bus.service';

export interface CreateOutboxEventPayload {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly eventBus: EventBusService) {}

  async publishOutboxEvent(event: CreateOutboxEventPayload): Promise<void> {
    this.logger.log(`Outbox publishing event [${event.eventType}] for aggregate [${event.aggregateType}:${event.aggregateId}]`);
    await this.eventBus.publish(event.eventType, {
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      ...event.payload,
    });
  }
}
