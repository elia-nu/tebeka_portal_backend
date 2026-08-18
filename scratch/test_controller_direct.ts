import { AuthController } from '../apps/user-service/src/modules/auth/auth.controller';
import { AuthService } from '../apps/user-service/src/modules/auth/auth.service';

async function testDirect() {
  const authService = new AuthService();
  const authController = new AuthController(authService);

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
    const res = await authController.registerAttorney([], testBody, { headers: {} }, {});
    console.log('DIRECT CONTROLLER REGISTRATION SUCCESS:', res);
  } catch (err: any) {
    console.error('DIRECT CONTROLLER ERROR:', err);
  }
}

testDirect();
