import { Injectable } from '@nestjs/common';
import { PrismaClient, QueueJobStatus, NotificationChannel } from '@prisma/client/communication';
import { AppLoggerService } from '@workspace/logger';
import { SmsService } from '@workspace/sms';

const prisma = new PrismaClient();

@Injectable()
export class SmsDeliveryService {
  constructor(
    private readonly smsService: SmsService,
    private readonly logger: AppLoggerService
  ) {}

  async sendSmsJob(jobId: string) {
    const job = await prisma.sMSQueue.findUnique({
      where: { id: jobId },
      include: { notification: true },
    });

    if (!job || job.status === QueueJobStatus.COMPLETED) return;

    try {
      this.logger.log(`[SMS-DELIVERY] Dispatching SMS job ${jobId} to ${job.recipientPhone}...`, 'SmsDeliveryService');

      const result = await this.smsService.sendSms({
        to: job.recipientPhone,
        message: job.messageText,
      });

      if (!result.success && result.error && !result.error.includes('not configured')) {
        throw new Error(result.error);
      }

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
          provider: 'AFROMESSAGE',
          status: result.success ? 'DELIVERED' : 'MOCKED_SENT',
          attemptNumber: job.attempts + 1,
          providerMessageId: result.messageId || null,
          deliveredAt: new Date(),
          responsePayload: result.responseData ? result.responseData : undefined,
        },
      });

      this.logger.log(`[SMS-DELIVERY] SMS job ${jobId} delivered successfully to ${job.recipientPhone} (msgId: ${result.messageId || 'N/A'})`, 'SmsDeliveryService');
    } catch (error: any) {
      const nextAttempts = job.attempts + 1;
      const isDeadLetter = nextAttempts >= job.maxAttempts;
      const backoffMinutes = Math.pow(2, nextAttempts);
      const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      this.logger.error(`[SMS-DELIVERY] Failed dispatching SMS job ${jobId} to ${job.recipientPhone}: ${error?.message || error}`, error?.stack, 'SmsDeliveryService');

      try {
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
            provider: 'AFROMESSAGE',
            status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
            attemptNumber: nextAttempts,
            errorMessage: error?.message || String(error),
          },
        });
      } catch (dbErr) {
        // Job or notification already deleted
      }
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
