import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AppConfigService } from '@workspace/config';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private queues: Map<string, Queue> = new Map();

  constructor(private readonly configService: AppConfigService) {}

  onModuleInit() {
    this.logger.log('Initializing Scheduler Service with BullMQ...');
  }

  async onModuleDestroy() {
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
      } catch (err) {
        this.logger.warn(`Error closing BullMQ queue [${name}]: ${err.message}`);
      }
    }
  }

  getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: {
          host: this.configService.redisHost,
          port: this.configService.redisPort,
          maxRetriesPerRequest: 3,
        },
      });
      queue.on('error', (err) => {
        this.logger.warn(`BullMQ queue [${queueName}] error: ${err.message}`);
      });
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName)!;
  }

  async addCronJob(queueName: string, jobName: string, data: any, cronPattern: string) {
    const queue = this.getQueue(queueName);
    await queue.add(jobName, data, {
      repeat: { pattern: cronPattern },
    });
    this.logger.log(`Scheduled job [${jobName}] on queue [${queueName}] with cron pattern [${cronPattern}]`);
  }
}
