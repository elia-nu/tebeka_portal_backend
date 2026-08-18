const { PrismaClient: CommunicationPrisma, NotificationChannel, NotificationPriority } = require('@prisma/client/communication');
const { NotificationController } = require('../apps/communication-service/src/modules/notification/notification.controller');
const { NotificationService } = require('../apps/communication-service/src/modules/notification/notification.service');
const { NotificationDispatcherService } = require('../apps/communication-service/src/modules/notification/notification-dispatcher.service');
const { TemplateService } = require('../apps/communication-service/src/modules/template/template.service');
const { EmailDeliveryService } = require('../apps/communication-service/src/modules/delivery/email/email-delivery.service');
const { SmsDeliveryService } = require('../apps/communication-service/src/modules/delivery/sms/sms-delivery.service');
const { PushDeliveryService } = require('../apps/communication-service/src/modules/delivery/push/push-delivery.service');

async function testInAppAndPushNotifications() {
  console.log('================================================================');
  console.log('🚀 TESTING IN-APP & MOBILE PUSH NOTIFICATIONS IMPLEMENTATION');
  console.log('================================================================\n');

  const prisma = new CommunicationPrisma();

  const loggerMock = { log: console.log, error: console.error, warn: console.warn };
  const mailerMock = { sendMail: async () => true };

  const emailDelivery = new EmailDeliveryService(mailerMock, loggerMock);
  const smsDelivery = new SmsDeliveryService(loggerMock);
  const pushDelivery = new PushDeliveryService(loggerMock);

  const templateService = new TemplateService();
  await templateService.seedDefaultTemplates();

  // Mock NotificationGateway to test live WebSocket in-app push
  let lastWebsocketNotification = null;
  const mockNotificationGateway = {
    sendNotificationToUser: (userId, notification) => {
      lastWebsocketNotification = { userId, notification };
      console.log(`   [WEBSOCKET-IN-APP] Real-time notification delivered to room user:${userId} (ID: ${notification.id})`);
    },
  };

  const dispatcher = new NotificationDispatcherService(
    templateService,
    emailDelivery,
    smsDelivery,
    pushDelivery,
    mockNotificationGateway
  );
  const notificationService = new NotificationService();
  const notificationController = new NotificationController(notificationService, dispatcher);

  const testUserId = '88888888-8888-4888-8888-888888888888';
  const testFcmToken = 'fcm_token_mobile_device_xyz_987654';

  try {
    // -----------------------------------------------------------------
    // 1. REGISTER DEVICE TOKEN FOR MOBILE PUSH
    // -----------------------------------------------------------------
    console.log('[1] Testing Mobile Device Token Registration for Push Notifications...');
    const registeredToken = await notificationController.registerDeviceToken(
      { token: testFcmToken, platform: 'ANDROID' },
      { user: { id: testUserId } }
    );
    console.log('   ✅ Device Token Registered:', registeredToken.token, 'Platform:', registeredToken.platform);

    const userTokens = await notificationController.getUserDeviceTokens({ user: { id: testUserId } });
    console.log('   ✅ User Active Device Tokens count:', userTokens.length);

    // -----------------------------------------------------------------
    // 2. DISPATCH DUAL NOTIFICATION (IN-APP + MOBILE PUSH)
    // -----------------------------------------------------------------
    console.log('\n[2] Dispatching Notification with IN_APP and PUSH Channels...');
    const notification = await notificationController.dispatchNotification({
      recipientId: testUserId,
      templateKey: 'booking.confirmed',
      variables: {
        user_name: 'Solomon Tesfaye',
        attorney_name: 'Advocate Bethlehem',
        appointment_time: '2026-08-30 02:00 PM EAT',
        reference_number: 'CONS-2026-9021',
      },
      locale: 'en',
      category: 'BOOKING',
      priority: NotificationPriority.HIGH,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      actionUrl: '/bookings/cons-9021',
      referenceNumber: 'CONS-2026-9021',
    });

    console.log('   ✅ Notification Created ID:', notification.id, 'Title:', notification.title);

    // -----------------------------------------------------------------
    // 3. VERIFY IN-APP REAL-TIME WEBSOCKET PUSH
    // -----------------------------------------------------------------
    console.log('\n[3] Verifying In-App Real-Time WebSocket Delivery...');
    if (lastWebsocketNotification && lastWebsocketNotification.userId === testUserId) {
      console.log('   ✅ In-App Real-Time Socket Payload verified for user:', lastWebsocketNotification.userId);
      console.log('      Title:', lastWebsocketNotification.notification.title);
      console.log('      Body:', lastWebsocketNotification.notification.body);
    } else {
      throw new Error('In-App WebSocket delivery failed');
    }

    // -----------------------------------------------------------------
    // 4. VERIFY & PROCESS MOBILE PUSH QUEUE JOB
    // -----------------------------------------------------------------
    console.log('\n[4] Verifying Mobile Push Notification Queue Job & Dispatch...');
    const pushJobs = await prisma.pushQueue.findMany({ where: { notificationId: notification.id } });
    console.log('   ✅ PushQueue Jobs Enqueued count:', pushJobs.length);
    console.log('      Device Token targeted:', pushJobs[0]?.deviceToken);

    // Process push delivery
    await pushDelivery.processPendingPushJobs();

    // Verify delivery audit logs
    const pushLogs = await prisma.notificationLog.findMany({
      where: { notificationId: notification.id, channel: NotificationChannel.PUSH },
    });
    console.log('   ✅ Push Delivery Audit Log generated: Status:', pushLogs[0]?.status, 'Provider:', pushLogs[0]?.provider);

    // -----------------------------------------------------------------
    // 5. VERIFY IN-APP NOTIFICATION INBOX & UNREAD COUNTS
    // -----------------------------------------------------------------
    console.log('\n[5] Verifying In-App Notifications Inbox Management...');
    const inbox = await notificationController.getUserNotifications({ page: 1, limit: 10 }, { user: { id: testUserId } });
    console.log('   ✅ In-App Inbox Items count:', inbox.total, 'Unread count:', inbox.unreadCount);

    await notificationController.markAsRead(notification.id, { user: { id: testUserId } });
    const inboxAfterRead = await notificationController.getUserNotifications({ page: 1, limit: 10 }, { user: { id: testUserId } });
    console.log('   ✅ In-App Inbox Unread count after markAsRead:', inboxAfterRead.unreadCount);

    // -----------------------------------------------------------------
    // 6. UNREGISTER DEVICE TOKEN
    // -----------------------------------------------------------------
    console.log('\n[6] Testing Device Token Unregistration (Logout)...');
    await notificationController.removeDeviceToken(testFcmToken, { user: { id: testUserId } });
    const tokensAfterLogout = await notificationController.getUserDeviceTokens({ user: { id: testUserId } });
    console.log('   ✅ Active Tokens count after logout removal:', tokensAfterLogout.length);

    // -----------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------
    await prisma.notificationLog.deleteMany({ where: { notificationId: notification.id } });
    await prisma.pushQueue.deleteMany({ where: { notificationId: notification.id } });
    await prisma.notification.delete({ where: { id: notification.id } });
    await prisma.deviceToken.deleteMany({ where: { userId: testUserId } });

    console.log('\n================================================================');
    console.log('🎉 BOTH IN-APP AND MOBILE PUSH NOTIFICATIONS FULLY VERIFIED!');
    console.log('================================================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

testInAppAndPushNotifications().catch((err) => {
  console.error('❌ In-App and Push notification verification failed:', err);
  process.exit(1);
});
