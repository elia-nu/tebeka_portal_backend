import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaClient, QueueJobStatus, NotificationChannel } from '@prisma/client/communication';
import { AppLoggerService } from '@workspace/logger';

const prisma = new PrismaClient();

@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly logger: AppLoggerService
  ) {}

  async sendEmailJob(jobId: string) {
    const job = await prisma.emailQueue.findUnique({
      where: { id: jobId },
      include: { notification: true },
    });

    if (!job || job.status === QueueJobStatus.COMPLETED) return;

    try {
      await this.mailerService.sendMail({
        to: job.recipientEmail,
        subject: job.subject,
        html: job.htmlContent,
      });

      await prisma.emailQueue.update({
        where: { id: jobId },
        data: {
          status: QueueJobStatus.COMPLETED,
          attempts: job.attempts + 1,
        },
      });

      await prisma.notificationLog.create({
        data: {
          notificationId: job.notificationId,
          channel: NotificationChannel.EMAIL,
          provider: 'SMTP',
          status: 'DELIVERED',
          attemptNumber: job.attempts + 1,
          deliveredAt: new Date(),
        },
      });

      this.logger.log(`Email dispatched successfully to ${job.recipientEmail}`, 'EmailDeliveryService');
    } catch (error: any) {
      const nextAttempts = job.attempts + 1;
      const isDeadLetter = nextAttempts >= job.maxAttempts;
      const backoffMinutes = Math.pow(2, nextAttempts); // 2, 4, 8, 16 mins
      const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await prisma.emailQueue.update({
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
          channel: NotificationChannel.EMAIL,
          provider: 'SMTP',
          status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
          attemptNumber: nextAttempts,
          errorMessage: error?.message || String(error),
        },
      });

      this.logger.error(`Failed to send email to ${job.recipientEmail}: ${error?.message}`, error?.stack, 'EmailDeliveryService');
    }
  }

  async processPendingEmailJobs() {
    const pendingJobs = await prisma.emailQueue.findMany({
      where: {
        status: { in: [QueueJobStatus.PENDING, QueueJobStatus.FAILED] },
        nextAttemptAt: { lte: new Date() },
      },
      take: 20,
    });

    for (const job of pendingJobs) {
      await this.sendEmailJob(job.id);
    }
  }
}
