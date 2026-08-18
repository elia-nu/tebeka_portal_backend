const { PrismaClient: CommunicationPrisma, ConversationType, ParticipantRole, MessageType, NotificationChannel, NotificationPriority } = require('@prisma/client/communication');

const { ConversationController } = require('../apps/communication-service/src/modules/conversation/conversation.controller');
const { ConversationService } = require('../apps/communication-service/src/modules/conversation/conversation.service');

const { MessageController } = require('../apps/communication-service/src/modules/message/message.controller');
const { MessageService } = require('../apps/communication-service/src/modules/message/message.service');

const { TemplateController } = require('../apps/communication-service/src/modules/template/template.controller');
const { TemplateService } = require('../apps/communication-service/src/modules/template/template.service');

const { NotificationController } = require('../apps/communication-service/src/modules/notification/notification.controller');
const { NotificationService } = require('../apps/communication-service/src/modules/notification/notification.service');
const { NotificationDispatcherService } = require('../apps/communication-service/src/modules/notification/notification-dispatcher.service');

const { EmailDeliveryService } = require('../apps/communication-service/src/modules/delivery/email/email-delivery.service');
const { SmsDeliveryService } = require('../apps/communication-service/src/modules/delivery/sms/sms-delivery.service');
const { PushDeliveryService } = require('../apps/communication-service/src/modules/delivery/push/push-delivery.service');

async function testAllCommunicationEndpoints() {
  const prisma = new CommunicationPrisma();

  // Instantiate services & controllers
  const conversationService = new ConversationService();
  const conversationController = new ConversationController(conversationService);

  const messageService = new MessageService();
  const messageController = new MessageController(messageService);

  const templateService = new TemplateService();
  await templateService.seedDefaultTemplates();
  const templateController = new TemplateController(templateService);

  const loggerMock = { log: () => {}, error: () => {}, warn: () => {} };
  const mailerMock = { sendMail: async () => true };

  const emailDelivery = new EmailDeliveryService(mailerMock, loggerMock);
  const smsDelivery = new SmsDeliveryService(loggerMock);
  const pushDelivery = new PushDeliveryService(loggerMock);

  const dispatcher = new NotificationDispatcherService(templateService, emailDelivery, smsDelivery, pushDelivery);
  const notificationService = new NotificationService();
  const notificationController = new NotificationController(notificationService, dispatcher);

  const testClientId = '00000000-0000-0000-0000-000000000001';
  const testAttorneyId = '00000000-0000-0000-0000-000000000002';
  const testBookingId = '11111111-1111-1111-1111-111111111111';
  const testCaseId = '22222222-2222-2222-2222-222222222222';

  const results = [];

  function record(endpoint, method, reqPayload, resPayload) {
    results.push({
      endpoint,
      method,
      request: reqPayload,
      response: resPayload,
    });
  }

  try {
    console.log('Testing all endpoints in Communication Service...\n');

    // =========================================================================
    // 1. CONVERSATION ENDPOINTS
    // =========================================================================

    // 1.1 POST /api/v1/conversations
    const createConvReq = {
      title: 'Direct Client-Attorney Consultation',
      type: 'DIRECT',
      participantIds: [testClientId, testAttorneyId],
      role: 'CLIENT',
    };
    const createConvRes = await conversationController.createConversation(createConvReq, { user: { id: testClientId } });
    record('/api/v1/conversations', 'POST', createConvReq, createConvRes);

    const convId = createConvRes.id;

    // 1.2 GET /api/v1/conversations
    const listConvReq = { page: 1, limit: 10, status: 'ACTIVE' };
    const listConvRes = await conversationController.getUserConversations(listConvReq, { user: { id: testClientId } });
    record('/api/v1/conversations', 'GET', listConvReq, listConvRes);

    // 1.3 GET /api/v1/conversations/:id
    const getConvRes = await conversationController.getConversationDetails(convId, { user: { id: testClientId } });
    record(`/api/v1/conversations/${convId}`, 'GET', { id: convId }, getConvRes);

    // 1.4 POST /api/v1/conversations/by-booking/:bookingId
    const byBookingReq = { clientId: testClientId, attorneyId: testAttorneyId, title: 'Consultation Chat CONS-2026-99' };
    const byBookingRes = await conversationController.getOrCreateBookingChat(testBookingId, byBookingReq);
    record(`/api/v1/conversations/by-booking/${testBookingId}`, 'POST', byBookingReq, byBookingRes);

    // 1.5 GET /api/v1/conversations/by-booking/:bookingId
    const getByBookingRes = await conversationController.getBookingChat(testBookingId);
    record(`/api/v1/conversations/by-booking/${testBookingId}`, 'GET', { bookingId: testBookingId }, getByBookingRes);

    // 1.6 POST /api/v1/conversations/by-case/:caseId
    const byCaseReq = { clientId: testClientId, attorneyId: testAttorneyId, title: 'Case Discussion CASE-2026-101' };
    const byCaseRes = await conversationController.getOrCreateCaseChat(testCaseId, byCaseReq);
    record(`/api/v1/conversations/by-case/${testCaseId}`, 'POST', byCaseReq, byCaseRes);

    // 1.7 GET /api/v1/conversations/by-case/:caseId
    const getByCaseRes = await conversationController.getCaseChat(testCaseId);
    record(`/api/v1/conversations/by-case/${testCaseId}`, 'GET', { caseId: testCaseId }, getByCaseRes);

    // 1.8 POST /api/v1/conversations/:id/archive
    const archiveRes = await conversationController.archiveConversation(convId, { user: { id: testClientId } });
    record(`/api/v1/conversations/${convId}/archive`, 'POST', { id: convId }, archiveRes);

    // 1.9 POST /api/v1/conversations/:id/close
    const closeRes = await conversationController.closeConversation(convId, { user: { id: testAttorneyId } });
    record(`/api/v1/conversations/${convId}/close`, 'POST', { id: convId }, closeRes);

    // 1.10 POST /api/v1/conversations/:id/block
    const blockRes = await conversationController.blockConversation(convId, { user: { id: testAttorneyId } });
    record(`/api/v1/conversations/${convId}/block`, 'POST', { id: convId }, blockRes);

    // Reopen for message testing
    await prisma.conversation.update({ where: { id: convId }, data: { status: 'ACTIVE' } });
    await prisma.conversationParticipant.update({ where: { conversationId_userId: { conversationId: convId, userId: testClientId } }, data: { isArchived: false } });

    // =========================================================================
    // 2. MESSAGE ENDPOINTS
    // =========================================================================

    // 2.1 POST /api/v1/conversations/:id/messages
    const sendMsgReq = {
      content: 'Hello Counselor, I have uploaded the draft agreement for review.',
      messageType: 'TEXT',
      attachments: [
        {
          fileName: 'draft_agreement.pdf',
          fileKey: 'attachments/draft_agreement_178697.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 204800,
        },
      ],
    };
    const sendMsgRes = await messageController.sendMessage(convId, sendMsgReq, { user: { id: testClientId } });
    record(`/api/v1/conversations/${convId}/messages`, 'POST', sendMsgReq, sendMsgRes);

    const msgId = sendMsgRes.id;

    // 2.2 GET /api/v1/conversations/:id/messages
    const getMsgsReq = { page: 1, limit: 50 };
    const getMsgsRes = await messageController.getConversationMessages(convId, getMsgsReq, { user: { id: testClientId } });
    record(`/api/v1/conversations/${convId}/messages`, 'GET', getMsgsReq, getMsgsRes);

    // 2.3 PATCH /api/v1/messages/:id
    const editMsgReq = { content: 'Hello Counselor, I have uploaded the revised draft commercial agreement for review.' };
    const editMsgRes = await messageController.editMessage(msgId, editMsgReq, { user: { id: testClientId } });
    record(`/api/v1/messages/${msgId}`, 'PATCH', editMsgReq, editMsgRes);

    // 2.4 POST /api/v1/messages/:id/read
    const readMsgRes = await messageController.markMessageRead(msgId, { user: { id: testAttorneyId } });
    record(`/api/v1/messages/${msgId}/read`, 'POST', { id: msgId }, readMsgRes);

    // 2.5 POST /api/v1/conversations/:id/read-all
    const readAllRes = await messageController.markAllMessagesRead(convId, { user: { id: testAttorneyId } });
    record(`/api/v1/conversations/${convId}/read-all`, 'POST', { id: convId }, readAllRes);

    // 2.6 DELETE /api/v1/messages/:id
    const deleteMsgReq = { mode: 'DELETE_FOR_ME' };
    const deleteMsgRes = await messageController.deleteMessage(msgId, deleteMsgReq, { user: { id: testClientId } });
    record(`/api/v1/messages/${msgId}`, 'DELETE', deleteMsgReq, deleteMsgRes);

    // =========================================================================
    // 3. TEMPLATE ENDPOINTS
    // =========================================================================

    // 3.1 POST /api/v1/notification-templates
    const createTemplateReq = {
      key: `custom.hearing.reminder.${Date.now()}`,
      name: 'Court Hearing Reminder',
      description: 'Reminder sent 24h prior to court appearance',
      channels: ['EMAIL', 'SMS', 'IN_APP'],
      subjectEn: 'Court Hearing Reminder - {{case_number}}',
      subjectAm: 'የፍርድ ቤት ቀጠሮ ማስታወሻ - {{case_number}}',
      bodyEn: 'Dear {{user_name}}, your court hearing for {{case_number}} is scheduled at {{hearing_time}}.',
      bodyAm: 'ክቡር {{user_name}}፣ ለጉዳይ {{case_number}} የፍርድ ቤት ቀጠሮዎ በ {{hearing_time}} ተይዟል።',
      variables: ['user_name', 'case_number', 'hearing_time'],
    };
    const createTemplateRes = await templateController.createTemplate(createTemplateReq);
    record('/api/v1/notification-templates', 'POST', createTemplateReq, createTemplateRes);

    const templateKey = createTemplateReq.key;

    // 3.2 GET /api/v1/notification-templates
    const listTemplatesRes = await templateController.getAllTemplates();
    record('/api/v1/notification-templates', 'GET', {}, listTemplatesRes.slice(0, 3));

    // 3.3 GET /api/v1/notification-templates/:key
    const getTemplateRes = await templateController.getTemplate(templateKey);
    record(`/api/v1/notification-templates/${templateKey}`, 'GET', { key: templateKey }, getTemplateRes);

    // 3.4 PATCH /api/v1/notification-templates/:key
    const updateTemplateReq = { description: 'Updated 24h statutory court reminder' };
    const updateTemplateRes = await templateController.updateTemplate(templateKey, updateTemplateReq);
    record(`/api/v1/notification-templates/${templateKey}`, 'PATCH', updateTemplateReq, updateTemplateRes);

    // 3.5 POST /api/v1/notification-templates/:key/preview
    const previewReq = {
      locale: 'am',
      variables: {
        user_name: 'አቶ አበበ',
        case_number: 'F/C-2026-908',
        hearing_time: 'ነሐሴ 15 ቀን 2026 በ 3:30 ሰዓት',
      },
    };
    const previewRes = await templateController.previewTemplate(templateKey, previewReq);
    record(`/api/v1/notification-templates/${templateKey}/preview`, 'POST', previewReq, previewRes);

    // =========================================================================
    // 4. NOTIFICATION ENDPOINTS
    // =========================================================================

    // 4.1 POST /api/v1/notifications/dispatch
    const dispatchReq = {
      recipientId: testClientId,
      recipientEmail: 'client.test@example.com',
      recipientPhone: '+251911223344',
      templateKey: 'booking.confirmed',
      variables: {
        user_name: 'Dawit Getachew',
        attorney_name: 'Advocate Helen Solomon',
        appointment_time: '2026-08-25 10:00 AM EAT',
        reference_number: 'CONS-2026-0089',
      },
      locale: 'en',
      category: 'BOOKING',
      priority: 'HIGH',
      channels: ['IN_APP', 'EMAIL', 'SMS'],
    };
    const dispatchRes = await notificationController.dispatchNotification(dispatchReq);
    record('/api/v1/notifications/dispatch', 'POST', dispatchReq, dispatchRes);

    const notificationId = dispatchRes.id;

    // 4.2 GET /api/v1/notifications
    const listNotifReq = { page: 1, limit: 10, isRead: false };
    const listNotifRes = await notificationController.getUserNotifications(listNotifReq, { user: { id: testClientId } });
    record('/api/v1/notifications', 'GET', listNotifReq, listNotifRes);

    // 4.3 POST /api/v1/notifications/:id/read
    const readNotifRes = await notificationController.markAsRead(notificationId, { user: { id: testClientId } });
    record(`/api/v1/notifications/${notificationId}/read`, 'POST', { id: notificationId }, readNotifRes);

    // 4.4 POST /api/v1/notifications/read-all
    const readAllNotifRes = await notificationController.markAllAsRead({ user: { id: testClientId } });
    record('/api/v1/notifications/read-all', 'POST', {}, readAllNotifRes);

    // 4.5 DELETE /api/v1/notifications/:id
    const deleteNotifRes = await notificationController.deleteNotification(notificationId, { user: { id: testClientId } });
    record(`/api/v1/notifications/${notificationId}`, 'DELETE', { id: notificationId }, deleteNotifRes);

    // Output JSON result file for complete inspection
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, 'communication_endpoints_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Saved endpoint payloads to ${reportPath}`);

    // Cleanup
    await prisma.notificationTemplate.delete({ where: { key: templateKey } });
    await prisma.messageAttachment.deleteMany({ where: { messageId: msgId } });
    await prisma.messageRead.deleteMany({ where: { messageId: msgId } });
    await prisma.message.deleteMany({ where: { conversationId: convId } });
    await prisma.conversationParticipant.deleteMany({ where: { conversationId: convId } });
    await prisma.conversation.delete({ where: { id: convId } });
    await prisma.conversationParticipant.deleteMany({ where: { conversationId: byBookingRes.id } });
    await prisma.conversation.delete({ where: { id: byBookingRes.id } });
    await prisma.conversationParticipant.deleteMany({ where: { conversationId: byCaseRes.id } });
    await prisma.conversation.delete({ where: { id: byCaseRes.id } });
  } finally {
    await prisma.$disconnect();
  }
}

testAllCommunicationEndpoints().catch((err) => {
  console.error('Error testing communication endpoints:', err);
  process.exit(1);
});
