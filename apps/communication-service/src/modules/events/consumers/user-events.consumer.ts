import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '@workspace/event-bus';
import { NotificationDispatcherService } from '../../notification/notification-dispatcher.service';
import { AppLoggerService } from '@workspace/logger';

@Injectable()
export class UserEventsConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly logger: AppLoggerService
  ) {}

  async onModuleInit() {
    await this.eventBus.subscribe('USER_REGISTERED', async (payload: any) => {
      this.logger.log(`Received USER_REGISTERED event for user: ${payload.userId}`, 'UserEventsConsumer');
      await this.notificationDispatcher.dispatch({
        recipientId: payload.userId,
        recipientEmail: payload.email,
        templateKey: 'user.welcome',
        variables: { user_name: payload.name || 'Valued User' },
        category: 'AUTHENTICATION',
      });
    });

    await this.eventBus.subscribe('ATTORNEY_VERIFIED', async (payload: any) => {
      this.logger.log(`Received ATTORNEY_VERIFIED event for attorney: ${payload.attorneyId}`, 'UserEventsConsumer');
      await this.notificationDispatcher.dispatch({
        recipientId: payload.userId || payload.attorneyId,
        recipientEmail: payload.email,
        recipientPhone: payload.phone,
        title: 'Attorney Verification Approved',
        body: 'Congratulations! Your legal practice credentials have been verified. Your profile is now live.',
        category: 'VERIFICATION',
      });
    });
  }
}
