import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EventBusService } from '@workspace/event-bus';

@Injectable()
export class FinancialOutboxPublisherWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FinancialOutboxPublisherWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => this.publishPendingEvents(), 5000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async publishPendingEvents() {
    try {
      const pendingEvents = await this.prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        take: 20,
        orderBy: { createdAt: 'asc' },
      });

      for (const event of pendingEvents) {
        try {
          await this.eventBus.publish(event.eventType, {
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
            ...(typeof event.payload === 'object' ? event.payload : { data: event.payload }),
          });

          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
            },
          });

          this.logger.log(`Financial outbox event ${event.eventType} (${event.id}) published successfully.`);
        } catch (err) {
          this.logger.error(`Failed to publish financial outbox event ${event.id}:`, err);
        }
      }
    } catch (err: any) {
      if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
        this.logger.debug('Financial outbox table does not exist in database yet. Skipping poll until migration.');
      } else {
        this.logger.error('Error polling financial outbox events:', err);
      }
    }
  }
}
