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

  async subscribe(routingKey: string, handler: (data: any) => Promise<void>, queueName?: string): Promise<void> {
    const qName = queueName || `marketplace.queue.${routingKey}`;
    const dlqName = `${qName}.dlq`;
    if (!this.channelWrapper) {
      this.logger.warn(`Event bus channel not initialized. Subscription for ${routingKey} pending.`);
      return;
    }
    await this.channelWrapper.addSetup(async (channel: any) => {
      await channel.assertQueue(dlqName, { durable: true });
      await channel.bindQueue(dlqName, 'tebeka.dlq.exchange', '#');

      try {
        await channel.assertQueue(qName, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': 'tebeka.dlq.exchange',
            'x-dead-letter-routing-key': `${routingKey}.dlq`,
          },
        });
      } catch {
        await channel.assertQueue(qName, { durable: true });
      }
      await channel.bindQueue(qName, 'tebeka.events', routingKey);
      await channel.consume(qName, async (msg: any) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await handler(content);
            channel.ack(msg);
          } catch (err) {
            this.logger.error(`Error processing event [${routingKey}] - routing to DLQ:`, err);
            channel.nack(msg, false, false);
          }
        }
      });
    });
    this.logger.log(`Subscribed to event [${routingKey}] on queue [${qName}] with DLQ [${dlqName}]`);
  }
}
