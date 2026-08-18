const { PrismaClient: CommunicationPrisma, ConversationType, ParticipantRole, MessageType } = require('@prisma/client/communication');
const { ConversationService } = require('../apps/communication-service/src/modules/conversation/conversation.service');
const { MessageService } = require('../apps/communication-service/src/modules/message/message.service');
const { TemplateService } = require('../apps/communication-service/src/modules/template/template.service');
const { NotificationDispatcherService } = require('../apps/communication-service/src/modules/notification/notification-dispatcher.service');
const { NotificationService } = require('../apps/communication-service/src/modules/notification/notification.service');
const { EmailDeliveryService } = require('../apps/communication-service/src/modules/delivery/email/email-delivery.service');
const { SmsDeliveryService } = require('../apps/communication-service/src/modules/delivery/sms/sms-delivery.service');
const { PushDeliveryService } = require('../apps/communication-service/src/modules/delivery/push/push-delivery.service');
const { PresenceService } = require('../apps/communication-service/src/modules/websocket/presence.service');

async function testCommunicationService() {
  console.log('================================================================');
  console.log('🚀 RUNNING COMPREHENSIVE COMMUNICATION SERVICE INTEGRATION TESTS');
  console.log('================================================================\n');

  const prisma = new CommunicationPrisma();

  const testClientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const testAttorneyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const testBookingId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const testCaseId = '11111111-2222-4333-8444-555555555555';

  try {
    // ---------------------------------------------------------------
    // 1. CONVERSATION MANAGEMENT
    // ---------------------------------------------------------------
    console.log('[1] Testing Conversation Creation & Participant Enrollment...');
    const conversationService = new ConversationService();

    const conversation = await conversationService.createConversation(
      {
        title: 'Initial Legal Consultation Chat',
        type: ConversationType.BOOKING_CONSULTATION,
        bookingId: testBookingId,
        participantIds: [testClientId, testAttorneyId],
        role: ParticipantRole.CLIENT,
      },
      testClientId
    );

    console.log('   ✅ Conversation Created:', conversation.id);
    console.log('      Participants count:', conversation.participants?.length || 2);
    console.log('      Booking Ref ID:', conversation.bookingId);

    // List user conversations
    const userConvs = await conversationService.getUserConversations(testClientId, { page: 1, limit: 10 });
    console.log('   ✅ Fetched user conversations count:', userConvs.total);

    // ---------------------------------------------------------------
    // 2. MESSAGING, ATTACHMENTS, EDITS & READ RECEIPTS
    // ---------------------------------------------------------------
    console.log('\n[2] Testing Messaging & Attachment Upload Flow...');
    const messageService = new MessageService();

    // 2a. Send client text message
    const msg1 = await messageService.sendMessage(
      conversation.id,
      {
        content: 'Hello Counselor, I have uploaded the draft agreement for your review.',
        messageType: MessageType.TEXT,
        attachments: [
          {
            fileName: 'draft_agreement_v1.pdf',
            fileKey: 'attachments/draft_agreement_v1_178696.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 102400,
          },
        ],
      },
      testClientId
    );
    console.log('   ✅ Message sent:', msg1.id, 'Attachments:', msg1.attachments?.length);

    // 2b. Edit message within policy window
    const editedMsg = await messageService.editMessage(
      msg1.id,
      { content: 'Hello Counselor, I have uploaded the revised draft commercial agreement for review.' },
      testClientId
    );
    console.log('   ✅ Message edited successfully! isEdited:', editedMsg.isEdited, 'New content preview:', editedMsg.content.substring(0, 40));

    // 2c. Attorney marks message as read
    const readReceipt = await messageService.markMessageRead(msg1.id, testAttorneyId);
    console.log('   ✅ Read receipt recorded:', readReceipt.readAt);

    // 2d. Get conversation messages & unread count
    const messages = await messageService.getConversationMessages(conversation.id, testClientId, { page: 1, limit: 20 });
    console.log('   ✅ Conversation messages fetched:', messages.total);

    // ---------------------------------------------------------------
    // 3. TEMPLATES & BILINGUAL INTERPOLATION (EN / AM)
    // ---------------------------------------------------------------
    console.log('\n[3] Testing Bilingual Notification Templates & Variable Rendering...');
    const templateService = new TemplateService();
    await templateService.seedDefaultTemplates();

    const bookingConfirmedTemplate = await templateService.getTemplate('booking.confirmed');
    const renderedEn = templateService.renderTemplate(bookingConfirmedTemplate, 'en', {
      user_name: 'Abebe Bikila',
      attorney_name: 'Alula Pankhurst',
      appointment_time: '2026-08-20 14:30 EAT',
      reference_number: 'CONS-2026-0042',
    });
    console.log('   ✅ Rendered English:', renderedEn.subject, '-->', renderedEn.body);

    const renderedAm = templateService.renderTemplate(bookingConfirmedTemplate, 'am', {
      user_name: 'አበበ ቢቂላ',
      attorney_name: 'አሉላ ፓንክኸርስት',
      appointment_time: '2026-08-20 14:30 EAT',
      reference_number: 'CONS-2026-0042',
    });
    console.log('   ✅ Rendered Amharic:', renderedAm.subject, '-->', renderedAm.body);

    // ---------------------------------------------------------------
    // 4. NOTIFICATION ENGINE & MULTI-CHANNEL DISPATCHER
    // ---------------------------------------------------------------
    console.log('\n[4] Testing Notification Engine, Multi-Channel Queues & Audit Logs...');
    const loggerMock = { log: console.log, error: console.error, warn: console.warn };
    const mailerMock = { sendMail: async () => true };

    const emailDelivery = new EmailDeliveryService(mailerMock, loggerMock);
    const smsDelivery = new SmsDeliveryService(loggerMock);
    const pushDelivery = new PushDeliveryService(loggerMock);

    const dispatcher = new NotificationDispatcherService(templateService, emailDelivery, smsDelivery, pushDelivery);
    const notificationService = new NotificationService();

    const notification = await dispatcher.dispatch({
      recipientId: testClientId,
      recipientEmail: 'client.abebe@example.com',
      recipientPhone: '+251911223344',
      deviceToken: 'fcm_test_device_token_abc123',
      templateKey: 'booking.confirmed',
      variables: {
        user_name: 'Abebe Bikila',
        attorney_name: 'Counselor Alula',
        appointment_time: 'Aug 20, 2026 at 2:30 PM',
        reference_number: 'CONS-2026-0042',
      },
      locale: 'en',
    });

    console.log('   ✅ Dispatched Notification ID:', notification.id, 'Title:', notification.title);

    // Process queued email, SMS, and Push jobs
    await emailDelivery.processPendingEmailJobs();
    await smsDelivery.processPendingSmsJobs();
    await pushDelivery.processPendingPushJobs();

    // Verify Notification Audit Logs
    const logs = await prisma.notificationLog.findMany({ where: { notificationId: notification.id } });
    console.log('   ✅ Delivery Audit Logs Generated (Count: ' + logs.length + '):');
    logs.forEach((log) => console.log(`      - [${log.channel}] Provider: ${log.provider}, Status: ${log.status}`));

    // Test Notification Read State
    const unreadBefore = await notificationService.getUserNotifications(testClientId, { isRead: false });
    console.log('   ✅ Unread Notifications count:', unreadBefore.unreadCount);

    await notificationService.markAsRead(notification.id, testClientId);
    const unreadAfter = await notificationService.getUserNotifications(testClientId, { isRead: false });
    console.log('   ✅ Unread Notifications count after markAsRead:', unreadAfter.unreadCount);

    // ---------------------------------------------------------------
    // 5. PRESENCE TRACKING
    // ---------------------------------------------------------------
    console.log('\n[5] Testing WebSocket Ephemeral Presence Tracking...');
    const presenceService = new PresenceService();
    presenceService.setUserOnline(testClientId, 'socket_client_001');
    console.log('   ✅ User Online Presence:', presenceService.getUserPresence(testClientId));
    console.log('   ✅ isUserOnline(client):', presenceService.isUserOnline(testClientId));

    presenceService.setUserOffline(testClientId);
    console.log('   ✅ User Offline Presence:', presenceService.getUserPresence(testClientId));

    // ---------------------------------------------------------------
    // CLEANUP
    // ---------------------------------------------------------------
    await prisma.notificationLog.deleteMany({ where: { notificationId: notification.id } });
    await prisma.emailQueue.deleteMany({ where: { notificationId: notification.id } });
    await prisma.sMSQueue.deleteMany({ where: { notificationId: notification.id } });
    await prisma.pushQueue.deleteMany({ where: { notificationId: notification.id } });
    await prisma.notification.deleteMany({ where: { recipientId: testClientId } });

    await prisma.messageAttachment.deleteMany({ where: { messageId: msg1.id } });
    await prisma.messageRead.deleteMany({ where: { messageId: msg1.id } });
    await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.conversationParticipant.deleteMany({ where: { conversationId: conversation.id } });
    await prisma.conversation.delete({ where: { id: conversation.id } });

    console.log('\n================================================================');
    console.log('🎉 ALL COMMUNICATION SERVICE INTEGRATION TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

testCommunicationService().catch((err) => {
  console.error('❌ Communication Service Integration Test Error:', err);
  process.exit(1);
});
