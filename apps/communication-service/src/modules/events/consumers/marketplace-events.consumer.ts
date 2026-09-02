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
    // 1. Consultation Requested
    await this.eventBus.subscribe('BOOKING_REQUESTED', async (payload: any) => {
      this.logger.log(`Received BOOKING_REQUESTED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      const appointmentTime = `${payload.bookingDate ? new Date(payload.bookingDate).toISOString().split('T')[0] : ''} ${payload.startTime || ''} - ${payload.endTime || ''}`;

      if (payload.attorneyId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.attorneyId,
          recipientEmail: payload.attorneyEmail,
          recipientPhone: payload.attorneyPhone,
          templateKey: 'booking.requested',
          variables: {
            user_name: payload.attorneyName || 'Attorney',
            reference_number: payload.referenceNumber || payload.bookingId,
            appointment_time: appointmentTime,
          },
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    // 2. Booking / Consultation Created
    await this.eventBus.subscribe('BOOKING_CREATED', async (payload: any) => {
      this.logger.log(`Received BOOKING_CREATED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
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

    // 3. Consultation Confirmed
    await this.eventBus.subscribe('BOOKING_CONFIRMED', async (payload: any) => {
      this.logger.log(`Received BOOKING_CONFIRMED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      
      const meetingLink = payload.meetingLink || `https://meet.google.com/${payload.referenceNumber || payload.bookingId}`;
      const appointmentTime = `${payload.bookingDate ? new Date(payload.bookingDate).toISOString().split('T')[0] : ''} ${payload.startTime || ''} - ${payload.endTime || ''}`;

      // Notify Client
      if (payload.clientId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.clientId,
          recipientEmail: payload.clientEmail,
          recipientPhone: payload.clientPhone,
          templateKey: 'booking.confirmed',
          variables: {
            user_name: payload.clientName || 'Valued Client',
            attorney_name: payload.attorneyName || 'Attorney',
            appointment_time: appointmentTime,
            reference_number: payload.referenceNumber || payload.bookingId,
            meeting_link: meetingLink,
          },
          actionUrl: meetingLink,
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }

      // Notify Attorney
      if (payload.attorneyId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.attorneyId,
          recipientEmail: payload.attorneyEmail,
          recipientPhone: payload.attorneyPhone,
          templateKey: 'booking.confirmed',
          variables: {
            user_name: payload.attorneyName || 'Counselor',
            attorney_name: 'Client ' + (payload.clientName || ''),
            appointment_time: appointmentTime,
            reference_number: payload.referenceNumber || payload.bookingId,
            meeting_link: meetingLink,
          },
          actionUrl: meetingLink,
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    // 4. Consultation Rescheduled
    await this.eventBus.subscribe('BOOKING_RESCHEDULED', async (payload: any) => {
      this.logger.log(`Received BOOKING_RESCHEDULED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      const meetingLink = payload.meetingLink || `https://meet.google.com/${payload.referenceNumber || payload.bookingId}`;
      const appointmentTime = `${payload.bookingDate ? new Date(payload.bookingDate).toISOString().split('T')[0] : ''} ${payload.startTime || ''} - ${payload.endTime || ''}`;

      if (payload.clientId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.clientId,
          recipientEmail: payload.clientEmail,
          recipientPhone: payload.clientPhone,
          templateKey: 'booking.rescheduled',
          variables: {
            user_name: payload.clientName || 'Client',
            reference_number: payload.referenceNumber || payload.bookingId,
            appointment_time: appointmentTime,
            meeting_link: meetingLink,
          },
          actionUrl: meetingLink,
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }

      if (payload.attorneyId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.attorneyId,
          recipientEmail: payload.attorneyEmail,
          recipientPhone: payload.attorneyPhone,
          templateKey: 'booking.rescheduled',
          variables: {
            user_name: payload.attorneyName || 'Attorney',
            reference_number: payload.referenceNumber || payload.bookingId,
            appointment_time: appointmentTime,
            meeting_link: meetingLink,
          },
          actionUrl: meetingLink,
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    // 5. Consultation Cancelled
    await this.eventBus.subscribe('BOOKING_CANCELLED', async (payload: any) => {
      this.logger.log(`Received BOOKING_CANCELLED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      if (payload.clientId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.clientId,
          recipientEmail: payload.clientEmail,
          recipientPhone: payload.clientPhone,
          templateKey: 'booking.cancelled',
          variables: {
            user_name: payload.clientName || 'Client',
            reference_number: payload.referenceNumber || payload.bookingId,
            refund_amount: payload.refundAmount || 0,
          },
          category: 'BOOKING',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    // 6. Case Created
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

        await this.notificationDispatcher.dispatch({
          recipientId: payload.attorneyId,
          recipientEmail: payload.attorneyEmail,
          recipientPhone: payload.attorneyPhone,
          templateKey: 'case.created',
          variables: {
            user_name: payload.attorneyName || 'Attorney',
            case_reference: payload.referenceNumber || payload.caseId,
            case_title: payload.title || 'Legal Representation',
          },
          category: 'CASE',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    // 7. Case Agreement Executed & Funded
    await this.eventBus.subscribe('AGREEMENT_EXECUTED', async (payload: any) => {
      this.logger.log(`Received AGREEMENT_EXECUTED event for case: ${payload.caseId}`, 'MarketplaceEventsConsumer');
      if (payload.clientId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.clientId,
          recipientEmail: payload.clientEmail,
          recipientPhone: payload.clientPhone,
          templateKey: 'agreement.executed',
          variables: {
            user_name: payload.clientName || 'Client',
            case_reference: payload.referenceNumber || payload.caseId,
            amount: payload.totalFee || payload.amount || 0,
          },
          category: 'CASE',
          referenceNumber: payload.referenceNumber,
        });
      }
      if (payload.attorneyId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.attorneyId,
          recipientEmail: payload.attorneyEmail,
          recipientPhone: payload.attorneyPhone,
          templateKey: 'agreement.executed',
          variables: {
            user_name: payload.attorneyName || 'Counselor',
            case_reference: payload.referenceNumber || payload.caseId,
            amount: payload.totalFee || payload.amount || 0,
          },
          category: 'CASE',
          referenceNumber: payload.referenceNumber,
        });
      }
    });

    // 8. Review / Feedback Requested (Post-Appointment)
    await this.eventBus.subscribe('REVIEW_REQUESTED', async (payload: any) => {
      this.logger.log(`Received REVIEW_REQUESTED event for booking: ${payload.bookingId}`, 'MarketplaceEventsConsumer');
      if (payload.clientId) {
        await this.notificationDispatcher.dispatch({
          recipientId: payload.clientId,
          recipientEmail: payload.clientEmail,
          recipientPhone: payload.clientPhone,
          templateKey: 'review.requested',
          variables: {
            user_name: payload.clientName || 'Client',
            attorney_name: payload.attorneyName || 'Attorney',
            reference_number: payload.referenceNumber || payload.bookingId,
          },
          category: 'REVIEW',
          referenceNumber: payload.referenceNumber,
        });
      }
    });
  }
}
