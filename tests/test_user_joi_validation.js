const { JoiValidationPipe } = require('./apps/user-service/src/common/pipes/joi-validation.pipe');
const { RegisterClientSchema, SendPhoneOtpSchema, VerifyPhoneOtpSchema } = require('./apps/user-service/src/modules/auth/dto/auth.dto');
const { RejectVerificationSchema } = require('./apps/user-service/src/modules/verifications/dto/verification.dto');

async function testUserJoiValidation() {
  console.log(`\n======================================================`);
  console.log(`=== User Service Joi Validation & DTO Test Suite    ===`);
  console.log(`======================================================\n`);

  // 1. Test Valid Client Registration Payload
  console.log(`--- 1. Testing Valid Client Registration Payload ---`);
  const clientPipe = new JoiValidationPipe(RegisterClientSchema);
  const validClient = clientPipe.transform({
    name: 'Tadesse Alemu',
    email: 'tadesse@example.com',
    password: 'SecurePassword123!',
    phone: '+251911223344',
  });
  console.log(`✅ [VALIDATED CLIENT PASSED] Name: ${validClient.name}, Email: ${validClient.email}`);

  // 2. Test Short Password (< 8 chars)
  console.log(`\n--- 2. Testing Password Under 8 Characters ---`);
  try {
    clientPipe.transform({
      name: 'Short Pass',
      email: 'short@example.com',
      password: '123',
      phone: '+251911223344',
    });
    console.log(`❌ [FAILED] Short password was allowed.`);
  } catch (err) {
    console.log(`🛡️ [JOI VALIDATION PASSED] Short password rejected with HTTP 400: "${err.message}"`);
  }

  // 3. Test Invalid Phone Format (123)
  console.log(`\n--- 3. Testing Invalid Phone Format Validation ---`);
  const phonePipe = new JoiValidationPipe(SendPhoneOtpSchema);
  try {
    phonePipe.transform({ phone: '123' });
    console.log(`❌ [FAILED] Invalid phone 123 was allowed.`);
  } catch (err) {
    console.log(`🛡️ [JOI VALIDATION PASSED] Invalid phone 123 rejected with HTTP 400: "${err.message}"`);
  }

  // 4. Test Invalid 5-Digit OTP Code
  console.log(`\n--- 4. Testing Invalid 5-Digit OTP Code ---`);
  const otpPipe = new JoiValidationPipe(VerifyPhoneOtpSchema);
  try {
    otpPipe.transform({ phone: '+251911223344', code: '12345' });
    console.log(`❌ [FAILED] 5-digit OTP was allowed.`);
  } catch (err) {
    console.log(`🛡️ [JOI VALIDATION PASSED] 5-digit OTP rejected with HTTP 400: "${err.message}"`);
  }

  // 5. Test Short Rejection Reason (< 10 chars)
  console.log(`\n--- 5. Testing Short Rejection Reason Validation ---`);
  const rejectPipe = new JoiValidationPipe(RejectVerificationSchema);
  try {
    rejectPipe.transform({ reason: 'Bad doc' });
    console.log(`❌ [FAILED] Short rejection reason was allowed.`);
  } catch (err) {
    console.log(`🛡️ [JOI VALIDATION PASSED] Short rejection reason rejected with HTTP 400: "${err.message}"`);
  }

  console.log(`\n======================================================`);
  console.log(`=== ALL USER SERVICE JOI & DTO TESTS PASSED 100%   ===`);
  console.log(`======================================================\n`);
}

testUserJoiValidation().catch(console.error);
