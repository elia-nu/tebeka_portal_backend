import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '@workspace/config';
import { validateEthiopianMobilePrefix } from '../apps/user-service/src/modules/auth/auth-shared/phone.util';
import { OtpService } from '../apps/user-service/src/modules/auth/services/otp.service';
import { RegistrationService } from '../apps/user-service/src/modules/auth/services/registration.service';
import { SessionTokenService } from '../apps/user-service/src/modules/auth/services/session-token.service';
import { EmailVerificationService } from '../apps/user-service/src/modules/auth/services/email-verification.service';
import { AuthController } from '../apps/user-service/src/modules/auth/auth.controller';
import { LoginService } from '../apps/user-service/src/modules/auth/services/login.service';
import { PasswordService } from '../apps/user-service/src/modules/auth/services/password.service';
import { TwoFactorService } from '../apps/user-service/src/modules/auth/services/two-factor.service';
import { AuthReportsService } from '../apps/user-service/src/modules/auth/services/auth-reports.service';
import { AppLoggerService } from '@workspace/logger';
import { CacheService } from '@workspace/cache';

const prisma = new PrismaClient();

class MemoryCacheService extends CacheService {
  private store = new Map<string, { val: any; expiresAt: number }>();
  constructor() {
    super({} as any);
  }
  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.val as T;
  }
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
    this.store.set(key, { val: value, expiresAt });
  }
  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
  async incrWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    const item = this.store.get(key);
    let count = 1;
    if (item && (!item.expiresAt || Date.now() <= item.expiresAt)) {
      count = Number(item.val) + 1;
    }
    this.store.set(key, { val: count, expiresAt: Date.now() + ttlSeconds * 1000 });
    return count;
  }
}

async function testWithTargetPhone(rawInputPhone = '0941893993') {
  console.log('\n==============================================================================');
  console.log(`📱 TESTING SMS OTP & REGISTRATION FLOW WITH PHONE: ${rawInputPhone}`);
  console.log('==============================================================================\n');

  const logger = new AppLoggerService('LivePhoneTest');
  const cacheService = new MemoryCacheService();
  const rawConfigService = new ConfigService({
    JWT_SECRET: 'test-jwt-secret-key-1234567890',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-1234567890',
    JWT_EXPIRES_IN: '7d',
    JWT_REFRESH_EXPIRES_IN: '30d',
  });
  const appConfigService = new AppConfigService(rawConfigService);
  const jwtService = new JwtService({
    secret: appConfigService.jwtSecret,
    signOptions: { expiresIn: '7d' },
  });

  const sessionTokenService = new SessionTokenService(jwtService, cacheService, appConfigService);
  const emailVerificationService = new EmailVerificationService(logger);
  const otpService = new OtpService(cacheService, logger);
  const registrationService = new RegistrationService(sessionTokenService, emailVerificationService, logger);
  const loginService = new LoginService(cacheService, sessionTokenService, logger);
  const passwordService = new PasswordService(logger);
  const twoFactorService = new TwoFactorService();
  const authReportsService = new AuthReportsService(cacheService);

  const authController = new AuthController(
    registrationService,
    otpService,
    loginService,
    sessionTokenService,
    emailVerificationService,
    passwordService,
    twoFactorService,
    authReportsService
  );

  // 1. Phone Format Normalization
  console.log(`🔍 [STEP 1] Phone Normalization Check`);
  const normalizedPhone = validateEthiopianMobilePrefix(rawInputPhone);
  console.log(`   - Input: "${rawInputPhone}" -> Normalised E.164: "${normalizedPhone}" ✅`);

  // 2. Check Existing User Status
  console.log(`\n🔍 [STEP 2] Check Existing DB Records for ${normalizedPhone}`);
  const existingUsers = await prisma.user.findMany({
    where: { phone: normalizedPhone },
    include: { attorneyProfile: true, accounts: true }
  });
  if (existingUsers.length > 0) {
    console.log(`   - Found ${existingUsers.length} existing user record(s):`);
    for (const u of existingUsers) {
      console.log(`     * ID: ${u.id}, Name: ${u.name}, Role: ${u.role}, Email: ${u.email}, PhoneVerified: ${u.phoneVerified}`);
    }
  } else {
    console.log(`   - No prior users with ${normalizedPhone} in DB (clean state).`);
  }

  // 3. Clear Cooldown & Request Live SMS OTP
  console.log(`\n📨 [STEP 3] Requesting SMS OTP via AfroMessage Gateway...`);
  await cacheService.del(`otp:cooldown:${normalizedPhone}`);

  const otpResponse = await authController.requestOtp({
    phone: rawInputPhone,
    purpose: 'REGISTRATION',
  });
  console.log(`   - Controller Response:`, JSON.stringify(otpResponse, null, 2));

  // 4. Retrieve DB OTP Record
  const latestOtp = await prisma.otpCode.findFirst({
    where: { phone: normalizedPhone, usedAt: null },
    orderBy: { createdAt: 'desc' }
  });

  if (!latestOtp) {
    throw new Error(`Failed to find generated OTP record in DB for ${normalizedPhone}`);
  }
  console.log(`   - Stored OTP Record: ID=${latestOtp.id}, ExpiresAt=${latestOtp.expiresAt.toISOString()}, Attempts=${latestOtp.attempts} ✅`);
  if (otpResponse.smsDispatched) {
    console.log(`   - 📲 LIVE SMS DISPATCHED to ${normalizedPhone} via AfroMessage!`);
  } else {
    console.log(`   - ℹ️ AfroMessage dispatch attempted (check system logs / AfroMessage dashboard).`);
  }

  // 5. Test Invalid OTP Verification
  console.log(`\n❌ [STEP 4] Testing Invalid OTP Verification with "000000"`);
  let invalidPassed = false;
  try {
    await authController.verifyOtp({ phone: rawInputPhone, code: '000000' });
  } catch (err: any) {
    invalidPassed = true;
    console.log(`   - Correctly rejected invalid code: "${err?.response?.message || err.message}" ✅`);
  }
  if (!invalidPassed) {
    throw new Error('Invalid OTP was unexpectedly accepted!');
  }

  // 6. Test Valid OTP Verification
  console.log(`\n🔑 [STEP 5] Verifying OTP and Minting Continuation Token`);
  // Find which code matches the hash (from 100000 to 999999 or inject known code)
  const testCode = '418939';
  const testCodeHash = await bcrypt.hash(testCode, 10);
  await prisma.otpCode.update({
    where: { id: latestOtp.id },
    data: { codeHash: testCodeHash, attempts: 0 }
  });

  const verifyResponse = await authController.verifyOtp({
    phone: rawInputPhone,
    code: testCode
  });
  console.log(`   - Verification Response:`, JSON.stringify(verifyResponse, null, 2));
  const continuationToken = verifyResponse.otpContinuationToken;
  console.log(`   - Obtained Scoped Continuation Token: "${continuationToken}" ✅`);

  // 7. Test Client Registration with the verified phone & token
  console.log(`\n👤 [STEP 6] Testing Client Registration with ${rawInputPhone}`);
  // Clean up any test user for this phone before creating to test cleanly
  for (const u of existingUsers) {
    if (u.role === 'CLIENT') {
      await prisma.session.deleteMany({ where: { userId: u.id } });
      await prisma.account.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
  }

  const clientRegistrationRes = await authController.registerClient(
    {
      name: 'Tebeka Client User',
      phone: rawInputPhone,
      email: 'client.0941893993@tebeka.et',
      password: 'SecureClientPassword2026!',
      otpContinuationToken: continuationToken,
      marketingConsent: true,
    },
    { headers: {} },
    {}
  );

  console.log(`   - Client Registration Result:`);
  console.log(`     * User ID: ${clientRegistrationRes.user.id}`);
  console.log(`     * Name: ${clientRegistrationRes.user.name}`);
  console.log(`     * Phone: ${clientRegistrationRes.user.phone}`);
  console.log(`     * Role: ${clientRegistrationRes.user.role}`);
  console.log(`     * Phone Verified: ${clientRegistrationRes.user.phoneVerified} ✅`);
  console.log(`     * Access Token: ${clientRegistrationRes.accessToken.substring(0, 35)}... ✅`);

  // 8. Test Attorney Registration with a fresh OTP & Token
  console.log(`\n⚖️ [STEP 7] Testing Attorney Registration Flow for ${rawInputPhone}`);
  await cacheService.del(`otp:cooldown:${normalizedPhone}`);
  const attorneyOtpReq = await authController.requestOtp({ phone: rawInputPhone, purpose: 'REGISTRATION' });
  const attorneyDbOtp = await prisma.otpCode.findFirst({
    where: { phone: normalizedPhone, usedAt: null },
    orderBy: { createdAt: 'desc' }
  });
  await prisma.otpCode.update({
    where: { id: attorneyDbOtp!.id },
    data: { codeHash: testCodeHash, attempts: 0 }
  });
  const attorneyVerifyRes = await authController.verifyOtp({ phone: rawInputPhone, code: testCode });

  // Clean existing attorney if present
  for (const u of existingUsers) {
    if (u.role === 'ATTORNEY') {
      await (prisma as any).session.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await (prisma as any).account.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await (prisma as any).user.delete({ where: { id: u.id } }).catch(() => {});
    }
  }

  const attorneyRegRes = await authController.registerAttorney(
    [],
    {
      fullName: 'Ato Solomon Desalegn',
      firstName: 'Solomon',
      middleName: 'Desalegn',
      surName: 'Mamo',
      email: 'attorney.0941893993@tebeka.et',
      phone: rawInputPhone,
      password: 'AttorneyPassword2026!',
      licenseNumber: 'LIC-ETH-2026-993',
      barRegistrationNumber: 'BAR-ETH-2026-993',
      barAdmissionYear: 2017,
      officeAddress: 'Bole Road, Mega Center, 4th Floor, Addis Ababa',
      subcity: 'Bole Subcity',
      lawFirmName: 'Solomon & Partners Law Firm',
      practiceAreas: ['Corporate Law', 'Litigation', 'Real Estate'],
      languagesSpoken: ['English', 'Amharic'],
      consultationFees: 2000,
      yearsOfExperience: 9,
      bio: 'High-court advocate with extensive experience in commercial contracts and property dispute resolution.',
      onlineConsultation: true,
      videoSupport: true,
      otpContinuationToken: attorneyVerifyRes.otpContinuationToken,
    },
    { headers: {} },
    {}
  );

  console.log(`   - Attorney Registration Result:`);
  console.log(`     * User ID: ${attorneyRegRes.user.id}`);
  console.log(`     * Attorney Profile ID: ${attorneyRegRes.user.attorneyProfileId}`);
  console.log(`     * Verification Case ID: ${attorneyRegRes.user.verificationCaseId}`);
  console.log(`     * Name: ${attorneyRegRes.user.name}`);
  console.log(`     * Email: ${attorneyRegRes.user.email}`);
  console.log(`     * Phone: ${attorneyRegRes.user.phone}`);
  console.log(`     * Phone Verified: ${attorneyRegRes.user.phoneVerified} ✅`);
  console.log(`     * Access Token: ${attorneyRegRes.accessToken.substring(0, 35)}... ✅`);

  // 9. AfroMessage Account Balance Check
  console.log(`\n🌐 [STEP 8] AfroMessage Account Status`);
  const afroToken = process.env.AFROMESSAGE_TOKEN;
  const afroBaseUrl = process.env.AFROMESSAGE_BASE_URL || 'https://api.afromessage.com/api';
  if (afroToken) {
    try {
      const bRes = await fetch(`${afroBaseUrl}/balance`, {
        headers: { Authorization: `Bearer ${afroToken}` }
      });
      const bData = await bRes.json();
      console.log(`   - Balance Response:`, JSON.stringify(bData));
    } catch (e: any) {
      console.log(`   - Balance check note: ${e.message}`);
    }
  }

  console.log('\n==============================================================================');
  console.log(`🎉 ALL TESTS COMPLETED SUCCESSFULLY FOR PHONE: ${rawInputPhone} (${normalizedPhone})`);
  console.log('==============================================================================\n');
}

testWithTargetPhone('0941893993')
  .catch((e) => {
    console.error('\n❌ Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
