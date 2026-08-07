import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class QueuesService {
  private queues = [
    { name: 'email-notifications', activeJobs: 0, completedJobs: 1420, failedJobs: 2, waitingJobs: 0 },
    { name: 'verification-indexer', activeJobs: 1, completedJobs: 310, failedJobs: 0, waitingJobs: 3 },
    { name: 'audit-log-outbox', activeJobs: 0, completedJobs: 5890, failedJobs: 1, waitingJobs: 0 },
  ];

  private jobs = [
    { id: 'job-101', queueName: 'email-notifications', name: 'send-welcome-email', data: { userId: 'u-1' }, status: 'FAILED', error: 'SMTP connection timeout', attempts: 3, createdAt: new Date() },
    { id: 'job-102', queueName: 'audit-log-outbox', name: 'publish-event', data: { event: 'USER_CREATED' }, status: 'FAILED', error: 'RabbitMQ queue full', attempts: 5, createdAt: new Date() },
  ];

  async getQueues() {
    return this.queues;
  }

  async getQueueStatistics() {
    const totalActive = this.queues.reduce((acc, q) => acc + q.activeJobs, 0);
    const totalCompleted = this.queues.reduce((acc, q) => acc + q.completedJobs, 0);
    const totalFailed = this.queues.reduce((acc, q) => acc + q.failedJobs, 0);
    const totalWaiting = this.queues.reduce((acc, q) => acc + q.waitingJobs, 0);

    return { totalActive, totalCompleted, totalFailed, totalWaiting, queuesCount: this.queues.length };
  }

  async retryJob(jobId: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found in queue`);
    job.status = 'WAITING';
    job.error = undefined;
    return { status: 'success', message: `Job ${jobId} queued for retry`, job };
  }

  async deleteJob(jobId: string) {
    const idx = this.jobs.findIndex(j => j.id === jobId);
    if (idx === -1) throw new NotFoundException(`Job ${jobId} not found`);
    this.jobs.splice(idx, 1);
    return { status: 'success', message: `Job ${jobId} deleted from queue` };
  }
}
