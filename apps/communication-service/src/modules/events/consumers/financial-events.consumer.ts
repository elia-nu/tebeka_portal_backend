import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '@workspace/event-bus';
import { NotificationDispatcherService } from '../../notification/notification-dispatcher.service';
import { AppLoggerService } from '@workspace/logger';

@Injectable()
export class FinancialEventsConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly logger: AppLoggerService
  ) {}

  async onModuleInit() {
    await this.eventBus.subscribe('PAYMENT_COMPLETED', async (payload: any) => {
      this.logger.log(`Received PAYMENT_COMPLETED event for payment: ${payload.paymentId}`, 'FinancialEventsConsumer');
      if (payload.userId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.userId,
          templateKey: 'payment.completed',
          variables: {
            user_name: 'Valued Client',
            amount: payload.amount || 0,
            item_name: payload.itemName || 'Legal Consultation',
            transaction_id: payload.transactionId || payload.paymentId,
          },
          category: 'PAYMENT',
        });
      }
    });
  }
}
