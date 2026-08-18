import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, QueueJobStatus, NotificationChannel } from '@prisma/client/communication';
import { AppLoggerService } from '@workspace/logger';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

@Injectable()
export class PushDeliveryService implements OnModuleInit {
  private firebaseApp: App | null = null;

  constructor(private readonly logger: AppLoggerService) {}

  onModuleInit() {
    try {
      const existingApps = getApps();
      if (!existingApps.length) {
        const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
        const projectId = process.env.FIREBASE_PROJECT_ID || 'entrance-zone';

        if (privateKey && clientEmail) {
          this.firebaseApp = initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
            projectId,
          });
          this.logger.log(`Firebase Admin initialized from environment variables (.env) for project: ${projectId}`, 'PushDeliveryService');
        } else {
          const credentialsPath = path.join(__dirname, '../../../config/firebase-service-account.json');
          if (fs.existsSync(credentialsPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            this.firebaseApp = initializeApp({
              credential: cert(serviceAccount),
              projectId: serviceAccount.project_id,
            });
            this.logger.log(`Firebase Admin initialized from config JSON for project: ${serviceAccount.project_id}`, 'PushDeliveryService');
          } else {
            this.logger.warn(`Firebase credentials not found in .env or config JSON`, 'PushDeliveryService');
          }
        }
      } else {
        this.firebaseApp = existingApps[0]!;
      }
    } catch (err: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err?.message}`, err?.stack, 'PushDeliveryService');
    }
  }

  async sendPushJob(jobId: string) {
    const job = await prisma.pushQueue.findUnique({
      where: { id: jobId },
      include: { notification: true },
    });

    if (!job || job.status === QueueJobStatus.COMPLETED) return;

    try {
      let messageId: string | null = null;

      if (this.firebaseApp && job.deviceToken && !job.deviceToken.startsWith('mock_')) {
        try {
          messageId = await getMessaging(this.firebaseApp).send({
            token: job.deviceToken,
            notification: {
              title: job.title,
              body: job.body,
            },
            data: job.dataPayload ? Object.fromEntries(
              Object.entries(job.dataPayload as Record<string, any>).map(([k, v]) => [k, String(v ?? '')])
            ) : undefined,
          });
          this.logger.log(`[FCM-PUSH] Push delivered to ${job.deviceToken} (FCM Message ID: ${messageId})`, 'PushDeliveryService');
        } catch (fcmError: any) {
          // If token invalid / unregistered, log and update
          this.logger.warn(`[FCM-PUSH] FCM Gateway response: ${fcmError?.message}`, 'PushDeliveryService');
          if (fcmError?.code === 'messaging/registration-token-not-registered' || fcmError?.code === 'messaging/invalid-registration-token') {
            await prisma.deviceToken.updateMany({
              where: { token: job.deviceToken },
              data: { isActive: false },
            });
          }
        }
      } else {
        this.logger.log(`[FCM-PUSH] Dispatched push to token ${job.deviceToken}: "${job.title}" - "${job.body}"`, 'PushDeliveryService');
      }

      await prisma.pushQueue.update({
        where: { id: jobId },
        data: {
          status: QueueJobStatus.COMPLETED,
          attempts: job.attempts + 1,
        },
      });

      await prisma.notificationLog.create({
        data: {
          notificationId: job.notificationId,
          channel: NotificationChannel.PUSH,
          provider: 'FIREBASE_FCM',
          status: 'DELIVERED',
          providerMessageId: messageId,
          attemptNumber: job.attempts + 1,
          deliveredAt: new Date(),
        },
      });
    } catch (error: any) {
      const nextAttempts = job.attempts + 1;
      const isDeadLetter = nextAttempts >= job.maxAttempts;
      const backoffMinutes = Math.pow(2, nextAttempts);
      const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await prisma.pushQueue.update({
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
          channel: NotificationChannel.PUSH,
          provider: 'FIREBASE_FCM',
          status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
          attemptNumber: nextAttempts,
          errorMessage: error?.message || String(error),
        },
      });
    }
  }

  async processPendingPushJobs() {
    const pendingJobs = await prisma.pushQueue.findMany({
      where: {
        status: { in: [QueueJobStatus.PENDING, QueueJobStatus.FAILED] },
        nextAttemptAt: { lte: new Date() },
      },
      take: 20,
    });

    for (const job of pendingJobs) {
      await this.sendPushJob(job.id);
    }
  }
}
