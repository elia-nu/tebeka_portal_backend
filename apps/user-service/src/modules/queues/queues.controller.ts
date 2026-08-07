import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { QueuesService } from './queues.service';

@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  async getQueues() {
    return this.queuesService.getQueues();
  }

  @Get('statistics')
  async getQueueStatistics() {
    return this.queuesService.getQueueStatistics();
  }

  @Post('retry/:jobId')
  async retryJob(@Param('jobId') jobId: string) {
    return this.queuesService.retryJob(jobId);
  }

  @Delete(':jobId')
  async deleteJob(@Param('jobId') jobId: string) {
    return this.queuesService.deleteJob(jobId);
  }
}
