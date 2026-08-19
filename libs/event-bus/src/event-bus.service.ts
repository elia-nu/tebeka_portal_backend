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
      this.connection = amqp.connect([this.configService.rabbitmqUri], {
        reconnectTimeInSeconds: 5,
        heartbeatIntervalInSeconds: 10,
      });

      this.connection.on('connect', () => {
        this.logger.log('Connected to RabbitMQ Event Bus successfully');
      });

      this.connection.on('disconnect', (params: any) => {
        this.logger.warn(`Disconnected from RabbitMQ: ${params?.err?.message || 'reconnecting...'}`);
      });

      this.connection.on('error', (err: any) => {
        this.logger.warn(`RabbitMQ connection error: ${err?.message || err}`);
      });

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: any) => {
          try {
            await Promise.all([
              channel.assertExchange('tebeka.events', 'topic', { durable: true }),
              channel.assertExchange('tebeka.dlq.exchange', 'topic', { durable: true }),
            ]);
          } catch (err: any) {
            this.logger.warn(`Exchange setup warning: ${err.message}`);
          }
        },
      });

      this.channelWrapper.on('connect', () => {
        this.logger.log('RabbitMQ channel wrapper connected');
      });

      this.channelWrapper.on('error', (err: any) => {
        this.logger.warn(`RabbitMQ channel wrapper error: ${err?.message || err}`);
      });

      this.channelWrapper.on('close', () => {
        this.logger.warn('RabbitMQ channel closed, waiting for reconnection');
      });
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

      await channel.assertQueue(qName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'tebeka.dlq.exchange',
          'x-dead-letter-routing-key': `${routingKey}.dlq`,
        },
      });
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

  async subscribeIdempotent(
    routingKey: string,
    consumerName: string,
    prisma: any,
    handler: (data: any) => Promise<void>,
    queueName?: string,
  ): Promise<void> {
    const qName = queueName || `${consumerName}.queue.${routingKey}`;
    const dlqName = `${qName}.dlq`;
    if (!this.channelWrapper) {
      this.logger.warn(`Event bus channel not initialized. Subscription for ${routingKey} pending.`);
      return;
    }
    await this.channelWrapper.addSetup(async (channel: any) => {
      await channel.assertQueue(dlqName, { durable: true });
      await channel.bindQueue(dlqName, 'tebeka.dlq.exchange', '#');

      await channel.assertQueue(qName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'tebeka.dlq.exchange',
          'x-dead-letter-routing-key': `${routingKey}.dlq`,
        },
      });
      await channel.bindQueue(qName, 'tebeka.events', routingKey);
      await channel.consume(qName, async (msg: any) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            const eventId =
              content.id ||
              content.paymentId ||
              content.bookingId ||
              content.aggregateId ||
              `${routingKey}-${Date.now()}`;

            // Idempotency check: attempt to insert into processed_events table
            try {
              if (prisma?.processedEvent) {
                await prisma.processedEvent.create({
                  data: {
                    eventId: String(eventId),
                    consumerName,
                  },
                });
              }
            } catch (err: any) {
              // Unique constraint violation (P2002) -> duplicate message
              if (err.code === 'P2002') {
                this.logger.warn(
                  `Duplicate event [${routingKey}] with id [${eventId}] already processed by [${consumerName}]. Acknowledging and skipping.`
                );
                channel.ack(msg);
                return;
              }
            }

            await handler(content);
            channel.ack(msg);
          } catch (err) {
            this.logger.error(`Error processing event [${routingKey}] - routing to DLQ:`, err);
            channel.nack(msg, false, false);
          }
        }
      });
    });
    this.logger.log(`Subscribed idempotently to event [${routingKey}] on queue [${qName}] for consumer [${consumerName}]`);
  }
}
