import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/communication-service/.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/user-service/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient as CommunicationPrisma, NotificationChannel, NotificationPriority } from '@prisma/client/communication';
import { NotificationService } from '../apps/communication-service/src/modules/notification/notification.service';
import { NotificationDispatcherService } from '../apps/communication-service/src/modules/notification/notification-dispatcher.service';
import { TemplateService } from '../apps/communication-service/src/modules/template/template.service';
import { EmailDeliveryService } from '../apps/communication-service/src/modules/delivery/email/email-delivery.service';
import { SmsDeliveryService } from '../apps/communication-service/src/modules/delivery/sms/sms-delivery.service';
import { PushDeliveryService } from '../apps/communication-service/src/modules/delivery/push/push-delivery.service';
import { SmsService, AfroMessageProvider } from '../libs/sms/src';
import { AppLoggerService } from '@workspace/logger';

const prisma = new CommunicationPrisma();

async function runNotificationPreferencesTest() {
  console.log('==============================================================================');
  console.log('🔔 TESTING NOTIFICATION CHANNEL PREFERENCES FOR CLIENTS & ATTORNEYS');
  console.log('==============================================================================\n');

  const logger = new AppLoggerService('PrefTest');
  const smsProvider = new AfroMessageProvider(logger);
  const smsService = new SmsService(smsProvider);
  const smsDeliveryService = new SmsDeliveryService(smsService, logger);
  const emailDeliveryService = new EmailDeliveryService(undefined, logger);
  const pushDeliveryService = new PushDeliveryService(logger);
  const templateService = new TemplateService();
  await templateService.seedDefaultTemplates();

  const notificationService = new NotificationService();
  const dispatcher = new NotificationDispatcherService(
    templateService,
    emailDeliveryService,
    smsDeliveryService,
    pushDeliveryService
  );

  const testClientId = '00000000-0000-0000-0000-0000000000c1';
  const testAttorneyId = '00000000-0000-0000-0000-0000000000a1';

  // Clean up existing test records
  await prisma.userNotificationPreference.deleteMany({
    where: { userId: { in: [testClientId, testAttorneyId] } },
  });

  // --- Step 1: Default Preferences Retrieval ---
  console.log('--- Step 1: Fetch Default Preferences for Client & Attorney ---');
  const clientDefaultPref = await notificationService.getUserPreferences(testClientId);
  console.log('Client Default Preferences:', JSON.stringify(clientDefaultPref.channels, null, 2));

  const attorneyDefaultPref = await notificationService.getUserPreferences(testAttorneyId);
  console.log('Attorney Default Preferences:', JSON.stringify(attorneyDefaultPref.channels, null, 2));

  if (!clientDefaultPref.channels.email || !clientDefaultPref.channels.sms || !clientDefaultPref.channels.in_app) {
    throw new Error('Default channels should all be true!');
  }
  console.log('✅ Default preferences verified!\n');

  // --- Step 2: Update Channel Preferences (Disable SMS for Client, Disable Email for Attorney) ---
  console.log('--- Step 2: Manage Notification Channels (Disable SMS for Client, Disable Email for Attorney) ---');
  const clientUpdatedPref = await notificationService.updateChannelPreferences(testClientId, {
    sms: false,
    email: true,
    push: true,
  });
  console.log('Client Updated Channels:', JSON.stringify(clientUpdatedPref.channels, null, 2));

  const attorneyUpdatedPref = await notificationService.updateChannelPreferences(testAttorneyId, {
    email: false,
    sms: true,
    push: true,
  });
  console.log('Attorney Updated Channels:', JSON.stringify(attorneyUpdatedPref.channels, null, 2));

  if (clientUpdatedPref.channels.sms !== false || attorneyUpdatedPref.channels.email !== false) {
    throw new Error('Channel update did not take effect!');
  }
  console.log('✅ Channel preference updates saved successfully!\n');

  // --- Step 3: Dispatch Booking Notification to Client (SMS should be suppressed) ---
  console.log('--- Step 3: Dispatch Consultation Notification to Client (SMS disabled) ---');
  const clientNotif = await dispatcher.dispatch({
    recipientId: testClientId,
    recipientEmail: 'client.test@tebeka.et',
    recipientPhone: '+251941893993',
    templateKey: 'booking.confirmed',
    category: 'BOOKING',
    variables: {
      user_name: 'Test Client',
      attorney_name: 'Counselor Abebe',
      appointment_time: '2026-09-02 09:00 - 10:00',
      reference_number: 'BK-TEST-001',
      meeting_link: 'https://meet.google.com/test-meet',
    },
  });

  console.log('Client Dispatched Channels:', clientNotif.channels);
  if (clientNotif.channels.includes(NotificationChannel.SMS)) {
    throw new Error('SMS channel was expected to be suppressed based on client preference!');
  }
  if (!clientNotif.channels.includes(NotificationChannel.EMAIL)) {
    throw new Error('Email channel was expected to be active for client!');
  }
  console.log('✅ Client preference correctly honored: SMS suppressed, Email retained!\n');

  // --- Step 4: Dispatch Booking Notification to Attorney (Email should be suppressed) ---
  console.log('--- Step 4: Dispatch Consultation Notification to Attorney (Email disabled) ---');
  const attorneyNotif = await dispatcher.dispatch({
    recipientId: testAttorneyId,
    recipientEmail: 'attorney.test@tebeka.et',
    recipientPhone: '+251941893993',
    templateKey: 'booking.confirmed',
    category: 'BOOKING',
    variables: {
      user_name: 'Counselor Abebe',
      attorney_name: 'Test Client',
      appointment_time: '2026-09-02 09:00 - 10:00',
      reference_number: 'BK-TEST-001',
      meeting_link: 'https://meet.google.com/test-meet',
    },
  });

  console.log('Attorney Dispatched Channels:', attorneyNotif.channels);
  if (attorneyNotif.channels.includes(NotificationChannel.EMAIL)) {
    throw new Error('Email channel was expected to be suppressed based on attorney preference!');
  }
  if (!attorneyNotif.channels.includes(NotificationChannel.SMS)) {
    throw new Error('SMS channel was expected to be active for attorney!');
  }
  console.log('✅ Attorney preference correctly honored: Email suppressed, SMS retained!\n');

  // --- Step 5: Test Critical/Verification Bypass ---
  console.log('--- Step 5: Critical/Verification Bypass Check ---');
  const authBypassNotif = await dispatcher.dispatch({
    recipientId: testClientId,
    recipientEmail: 'client.test@tebeka.et',
    recipientPhone: '+251941893993',
    templateKey: 'booking.confirmed',
    category: 'AUTHENTICATION',
    priority: NotificationPriority.CRITICAL,
    channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
    variables: {
      user_name: 'Test Client',
      attorney_name: 'System',
      appointment_time: 'Now',
      reference_number: 'AUTH-OTP-001',
      meeting_link: 'N/A',
    },
  });

  console.log('Critical Auth Notification Channels:', authBypassNotif.channels);
  if (!authBypassNotif.channels.includes(NotificationChannel.SMS)) {
    throw new Error('Critical security/auth notifications must bypass user mute!');
  }
  console.log('✅ Critical security/auth notifications correctly bypass channel mute!\n');

  // Wait briefly for asynchronous background delivery queues to process before cleanup
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Cleanup test records
  await prisma.notification.deleteMany({
    where: { recipientId: { in: [testClientId, testAttorneyId] } },
  });
  await prisma.userNotificationPreference.deleteMany({
    where: { userId: { in: [testClientId, testAttorneyId] } },
  });

  console.log('==============================================================================');
  console.log('🎉 ALL NOTIFICATION PREFERENCE TESTS PASSED SUCCESSFULLY!');
  console.log('==============================================================================\n');
}

runNotificationPreferencesTest().catch((err) => {
  console.error('❌ Notification preferences test failed:', err);
  process.exit(1);
});
