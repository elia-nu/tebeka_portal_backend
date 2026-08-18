import { Injectable, Optional } from '@nestjs/common';
import {
  PrismaClient,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  QueueJobStatus,
} from '@prisma/client/communication';
import { TemplateService } from '../template/template.service';
import { EmailDeliveryService } from '../delivery/email/email-delivery.service';
import { SmsDeliveryService } from '../delivery/sms/sms-delivery.service';
import { PushDeliveryService } from '../delivery/push/push-delivery.service';
import { NotificationGateway } from '../websocket/notification.gateway';

const prisma = new PrismaClient();

@Injectable()
export class NotificationDispatcherService {
  constructor(
    private readonly templateService: TemplateService,
    private readonly emailDeliveryService: EmailDeliveryService,
    private readonly smsDeliveryService: SmsDeliveryService,
    private readonly pushDeliveryService: PushDeliveryService,
    @Optional() private readonly notificationGateway?: NotificationGateway
  ) {}

  async dispatch(data: {
    recipientId: string;
    recipientEmail?: string;
    recipientPhone?: string;
    deviceToken?: string;
    templateKey?: string;
    title?: string;
    body?: string;
    category?: string;
    priority?: NotificationPriority;
    channels?: NotificationChannel[];
    actionUrl?: string;
    referenceNumber?: string;
    variables?: Record<string, any>;
    locale?: string;
  }) {
    let title = data.title || 'Notification';
    let body = data.body || '';
    let channels = data.channels || [NotificationChannel.IN_APP];

    // Resolve template if templateKey is provided
    if (data.templateKey) {
      try {
        const template = await this.templateService.getTemplate(data.templateKey);
        if (template) {
          channels = data.channels || template.channels;
          const rendered = this.templateService.renderTemplate(template, data.locale || 'en', data.variables || {});
          title = rendered.subject || title;
          body = rendered.body || body;
        }
      } catch (err) {
        // Fallback to direct title and body
      }
    }

    // Look up registered active device tokens for mobile push
    const userDeviceTokens = await prisma.deviceToken.findMany({
      where: { userId: data.recipientId, isActive: true },
    });

    const targetDeviceTokens = Array.from(
      new Set([
        ...(data.deviceToken ? [data.deviceToken] : []),
        ...userDeviceTokens.map((d) => d.token),
      ])
    );

    return prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          recipientId: data.recipientId,
          templateKey: data.templateKey || null,
          title,
          body,
          category: data.category || 'SYSTEM',
          priority: data.priority || NotificationPriority.NORMAL,
          channels,
          status: NotificationStatus.SENT,
          actionUrl: data.actionUrl || null,
          referenceNumber: data.referenceNumber || null,
          metadata: data.variables || null,
          sentAt: new Date(),
        },
      });

      // 1. IN-APP / REAL-TIME WEBSOCKET PUSH
      if (channels.includes(NotificationChannel.IN_APP) || channels.includes(NotificationChannel.WEBSOCKET)) {
        if (this.notificationGateway) {
          try {
            this.notificationGateway.sendNotificationToUser(data.recipientId, notification);
          } catch (err) {
            // Ignore if websocket gateway offline
          }
        }
      }

      // 2. EMAIL JOB
      if (channels.includes(NotificationChannel.EMAIL) && data.recipientEmail) {
        const emailJob = await tx.emailQueue.create({
          data: {
            notificationId: notification.id,
            recipientEmail: data.recipientEmail,
            subject: title,
            htmlContent: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #2d3748;">
              <h2 style="color: #1a365d;">${title}</h2>
              <p style="font-size: 16px; line-height: 1.5;">${body}</p>
              ${data.actionUrl ? `<a href="${data.actionUrl}" style="display: inline-block; padding: 10px 20px; background-color: #3182ce; color: #ffffff; text-decoration: none; border-radius: 6px; margin-top: 15px;">View Details</a>` : ''}
            </div>`,
            status: QueueJobStatus.PENDING,
          },
        });

        setImmediate(() => this.emailDeliveryService.sendEmailJob(emailJob.id));
      }

      // 3. SMS JOB
      if (channels.includes(NotificationChannel.SMS) && data.recipientPhone) {
        const smsJob = await tx.sMSQueue.create({
          data: {
            notificationId: notification.id,
            recipientPhone: data.recipientPhone,
            messageText: `${title}: ${body}`,
            status: QueueJobStatus.PENDING,
          },
        });

        setImmediate(() => this.smsDeliveryService.sendSmsJob(smsJob.id));
      }

      // 4. MOBILE PUSH NOTIFICATION JOBS (FCM / APNs)
      if (channels.includes(NotificationChannel.PUSH) && targetDeviceTokens.length > 0) {
        for (const token of targetDeviceTokens) {
          const pushJob = await tx.pushQueue.create({
            data: {
              notificationId: notification.id,
              deviceToken: token,
              title,
              body,
              dataPayload: {
                actionUrl: data.actionUrl,
                referenceNumber: data.referenceNumber,
                category: data.category,
                priority: data.priority,
              },
              status: QueueJobStatus.PENDING,
            },
          });

          setImmediate(() => this.pushDeliveryService.sendPushJob(pushJob.id));
        }
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Notification',
          aggregateId: notification.id,
          eventType: 'NOTIFICATION_CREATED',
          payload: {
            notificationId: notification.id,
            recipientId: data.recipientId,
            title,
            body,
            channels,
          },
        },
      });

      return notification;
    });
  }
}
