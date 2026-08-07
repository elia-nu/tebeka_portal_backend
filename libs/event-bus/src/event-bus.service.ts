import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import * as amqp from 'amqp-connection-manager';

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: amqp.ChannelWrapper;

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit() {
    try {
      this.connection = amqp.connect([this.configService.rabbitmqUri]);
      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: (channel: any) => {
          return Promise.all([
            channel.assertExchange('tebeka.events', 'topic', { durable: true }),
            channel.assertExchange('tebeka.dlq.exchange', 'topic', { durable: true }),
          ]);
        },
      });
      this.logger.log('Connected to RabbitMQ Event Bus successfully');
    } catch (err) {
      this.logger.error('Failed to initialize RabbitMQ Event Bus connection', err);
    }
  }

  async publish(routingKey: string, payload: any): Promise<void> {
    if (!this.channelWrapper) {
      this.logger.warn(`Event bus channel not initialized. Event ${routingKey} skipped.`);
      return;
    }
    await this.channelWrapper.publish('tebeka.events', routingKey, {
      ...payload,
      publishedAt: new Date().toISOString(),
    });
    this.logger.log(`Published event [${routingKey}]`);
  }
}
