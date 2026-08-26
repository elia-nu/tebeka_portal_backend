import { RegistrationService } from '../apps/user-service/src/modules/auth/services/registration.service';
import { OtpService } from '../apps/user-service/src/modules/auth/services/otp.service';
import { SessionTokenService } from '../apps/user-service/src/modules/auth/services/session-token.service';
import { EmailVerificationService } from '../apps/user-service/src/modules/auth/services/email-verification.service';

async function testDirect() {
  const sessionTokenService = new SessionTokenService({} as any, {} as any, {} as any);
  const emailVerificationService = new EmailVerificationService({} as any);
  const registrationService = new RegistrationService(sessionTokenService, emailVerificationService, {} as any);

  const testBody = {
    name: 'Form Data Attorney Direct',
    email: `direct_formdata_${Date.now()}@gmail.com`,
    password: 'AttorneyPass123!',
    phone: `+2519${Math.floor(10000000 + Math.random() * 90000000)}`,
    barRegistrationNumber: 'BAR-ETH-2026-888',
    barAdmissionYear: '2020',
    emailContinuationToken: 'email_cont_test_token'
  };

  try {
    const res = await registrationService.registerAttorney(testBody as any);
    console.log('DIRECT REGISTRATION SUCCESS:', res);
  } catch (err: any) {
    console.error('DIRECT ERROR:', err);
  }
}

testDirect();
