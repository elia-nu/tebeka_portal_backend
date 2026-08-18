import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBusService } from '@workspace/event-bus';
import { ConversationService } from '../../conversation/conversation.service';
import { NotificationDispatcherService } from '../../notification/notification-dispatcher.service';
import { AppLoggerService } from '@workspace/logger';
import { ConversationType, ParticipantRole } from '@prisma/client/communication';

@Injectable()
export class MarketplaceEventsConsumer implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly conversationService: ConversationService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly logger: AppLoggerService
  ) {}

  async onModuleInit() {
    await this.eventBus.subscribe('BOOKING_CREATED', async (payload: any) => {
      this.logger.log(`Received BOOKING_CREATED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      // Create conversation thread between client and attorney
      if (payload.clientId && payload.attorneyId) {
        await this.conversationService.createConversation(
          {
            title: `Consultation - ${payload.referenceNumber || payload.bookingId}`,
            type: ConversationType.BOOKING_CONSULTATION,
            bookingId: payload.bookingId,
            participantIds: [payload.clientId, payload.attorneyId],
            role: ParticipantRole.CLIENT,
          },
          payload.clientId
        );
      }
    });

    await this.eventBus.subscribe('BOOKING_CONFIRMED', async (payload: any) => {
      this.logger.log(`Received BOOKING_CONFIRMED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      if (payload.clientId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.clientId,
          templateKey: 'booking.confirmed',
          variables: {
            user_name: 'Client',
            attorney_name: 'Attorney',
            appointment_time: `${payload.bookingDate || ''} ${payload.startTime || ''}`,
            reference_number: payload.referenceNumber || payload.bookingId,
          },
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    await this.eventBus.subscribe('BOOKING_CANCELLED', async (payload: any) => {
      this.logger.log(`Received BOOKING_CANCELLED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      if (payload.clientId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.clientId,
          templateKey: 'booking.cancelled',
          variables: {
            user_name: 'Client',
            reference_number: payload.referenceNumber || payload.bookingId,
            refund_amount: payload.refundAmount || 0,
          },
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    await this.eventBus.subscribe('CASE_CREATED', async (payload: any) => {
      this.logger.log(`Received CASE_CREATED event for case: ${payload.caseId}`, 'MarketplaceEventsConsumer');
      if (payload.clientId && payload.attorneyId) {
        await this.conversationService.createConversation(
          {
            title: `Case: ${payload.title || payload.caseId}`,
            type: ConversationType.CASE_DISCUSSION,
            caseId: payload.caseId,
            participantIds: [payload.clientId, payload.attorneyId],
            role: ParticipantRole.CLIENT,
          },
          payload.clientId
        );
      }
    });
  }
}
