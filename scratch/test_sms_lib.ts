import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from apps/user-service/.env and apps/communication-service/.env
dotenv.config({ path: path.resolve(__dirname, '../apps/user-service/.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/communication-service/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import {
  SmsService,
  AfroMessageProvider,
  validateEthiopianMobilePrefix,
  isValidEthiopianMobile,
  normalizeEthiopianPhoneSafe,
} from '../libs/sms/src';

async function runLiveSmsTest() {
  const targetPhone = '0941893993';
  console.log(`======================================================================`);
  console.log(`🚀 TESTING @workspace/sms LIBRARY WITH LIVE NUMBER: ${targetPhone}`);
  console.log(`======================================================================\n`);

  console.log('--- Step 1: Phone Normalization & Validation ---');
  const normalized = validateEthiopianMobilePrefix(targetPhone);
  const isValid = isValidEthiopianMobile(targetPhone);
  const safe = normalizeEthiopianPhoneSafe(targetPhone);

  console.log(`Input Phone:     ${targetPhone}`);
  console.log(`Normalized:      ${normalized}`);
  console.log(`isValidMobile:   ${isValid}`);
  console.log(`Safe Normalizer: ${safe}`);

  if (normalized !== '+251941893993') {
    throw new Error(`Normalization failed! Expected '+251941893993', got '${normalized}'`);
  }
  console.log('✅ Phone normalization verified!\n');

  console.log('--- Step 2: AfroMessage Balance & Account Health Check ---');
  const provider = new AfroMessageProvider();
  const smsService = new SmsService(provider);

  const balanceResult = await smsService.checkBalance();
  console.log('Balance Result:', JSON.stringify(balanceResult, null, 2));

  console.log('\n--- Step 3: Live OTP SMS Dispatch ---');
  const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`Sending live OTP '${randomOtp}' to ${targetPhone}...`);
  const otpResult = await smsService.sendOtp({
    to: targetPhone,
    otpCode: randomOtp,
    purpose: 'REGISTRATION',
    validityMinutes: 5,
  });
  console.log('OTP Dispatch Result:', JSON.stringify(otpResult, null, 2));

  console.log('\n--- Step 4: Live Consultation Notification SMS Dispatch ---');
  const notifResult = await smsService.sendSms({
    to: targetPhone,
    message: 'Tebeka Legal Portal: Your consultation with Counselor Abebe is confirmed for 2026-09-02 at 09:00 AM. Join Google Meet: https://meet.google.com/tbk-meet-live',
  });
  console.log('Notification Dispatch Result:', JSON.stringify(notifResult, null, 2));

  console.log('\n======================================================================');
  if (otpResult.success && notifResult.success) {
    console.log(`🎉 SUCCESS: Live SMS messages successfully dispatched to ${targetPhone} via AfroMessage!`);
  } else {
    console.log(`⚠️ SMS dispatch completed with status: OTP success=${otpResult.success}, Notif success=${notifResult.success}`);
  }
  console.log(`======================================================================\n`);
}

runLiveSmsTest().catch((err) => {
  console.error('❌ Error during live SMS test:', err);
  process.exit(1);
});
