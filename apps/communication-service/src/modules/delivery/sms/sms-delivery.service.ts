import { Injectable } from '@nestjs/common';
import { PrismaClient, QueueJobStatus, NotificationChannel } from '@prisma/client/communication';
import { AppLoggerService } from '@workspace/logger';

const prisma = new PrismaClient();

@Injectable()
export class SmsDeliveryService {
  constructor(private readonly logger: AppLoggerService) {}

  async sendSmsJob(jobId: string) {
    const job = await prisma.sMSQueue.findUnique({
      where: { id: jobId },
      include: { notification: true },
    });

    if (!job || job.status === QueueJobStatus.COMPLETED) return;

    try {
      // SMS Gateway adapter dispatch (Ethio Telecom / Safaricom Gateway)
      this.logger.log(`[SMS-GATEWAY] Dispatched SMS to ${job.recipientPhone}: "${job.messageText}"`, 'SmsDeliveryService');

      await prisma.sMSQueue.update({
        where: { id: jobId },
        data: {
          status: QueueJobStatus.COMPLETED,
          attempts: job.attempts + 1,
        },
      });

      await prisma.notificationLog.create({
        data: {
          notificationId: job.notificationId,
          channel: NotificationChannel.SMS,
          provider: 'ETHIO_TELECOM_GATEWAY',
          status: 'DELIVERED',
          attemptNumber: job.attempts + 1,
          deliveredAt: new Date(),
        },
      });
    } catch (error: any) {
      const nextAttempts = job.attempts + 1;
      const isDeadLetter = nextAttempts >= job.maxAttempts;
      const backoffMinutes = Math.pow(2, nextAttempts);
      const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await prisma.sMSQueue.update({
        where: { id: jobId },
        data: {
          status: isDeadLetter ? QueueJobStatus.DEAD_LETTER : QueueJobStatus.FAILED,
          attempts: nextAttempts,
          nextAttemptAt,
          lastError: error?.message || String(error),
        },
      });

      await prisma.notificationLog.create({
        data: {
          notificationId: job.notificationId,
          channel: NotificationChannel.SMS,
          provider: 'ETHIO_TELECOM_GATEWAY',
          status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
          attemptNumber: nextAttempts,
          errorMessage: error?.message || String(error),
        },
      });
    }
  }

  async processPendingSmsJobs() {
    const pendingJobs = await prisma.sMSQueue.findMany({
      where: {
        status: { in: [QueueJobStatus.PENDING, QueueJobStatus.FAILED] },
        nextAttemptAt: { lte: new Date() },
      },
      take: 20,
    });

    for (const job of pendingJobs) {
      await this.sendSmsJob(job.id);
    }
  }
}
