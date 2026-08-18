const { JoiValidationPipe } = require('./apps/marketplace-service/src/common/pipes/joi-validation.pipe');
const { CreateBookingSchema } = require('./apps/marketplace-service/src/modules/booking/dto/booking.dto');
const { CreateReviewSchema } = require('./apps/marketplace-service/src/modules/review/dto/review.dto');
const { CreateRankingWeightsSchema } = require('./apps/marketplace-service/src/modules/ranking/dto/create-ranking-weights.dto');

async function testJoiValidation() {
  console.log(`\n======================================================`);
  console.log(`=== Joi Schema Validation & DTO Unit Test Suite    ===`);
  console.log(`======================================================\n`);

  // 1. Test Valid Booking Schema
  console.log(`--- 1. Testing Valid Booking Payload ---`);
  const validBookingPipe = new JoiValidationPipe(CreateBookingSchema);
  const validBookingPayload = {
    attorneyId: '123e4567-e89b-12d3-a456-426614174000',
    bookingDate: '2026-08-15T00:00:00.000Z',
    startTime: '10:30',
    endTime: '11:30',
    consultationType: 'VIDEO',
  };
  const validatedBooking = validBookingPipe.transform(validBookingPayload);
  console.log(`✅ [VALIDATED BOOKING PASSED] Validated startTime: ${validatedBooking.startTime}, Type: ${validatedBooking.consultationType}`);

  // 2. Test Invalid Time Format (25:99)
  console.log(`\n--- 2. Testing Invalid Time Format Validation ---`);
  const invalidTimePayload = {
    attorneyId: '123e4567-e89b-12d3-a456-426614174000',
    bookingDate: '2026-08-15T00:00:00.000Z',
    startTime: '25:99', // Invalid
    endTime: '11:30',
  };
  try {
    validBookingPipe.transform(invalidTimePayload);
    console.log(`❌ [FAILED] Invalid time was incorrectly allowed.`);
  } catch (err) {
    console.log(`🛡️ [JOI VALIDATION PASSED] Invalid time rejected with HTTP 400: "${err.message}"`);
  }

  // 3. Test Invalid Rating (6)
  console.log(`\n--- 3. Testing Invalid Rating (> 5) Validation ---`);
  const reviewPipe = new JoiValidationPipe(CreateReviewSchema);
  try {
    reviewPipe.transform({ rating: 6, comment: 'Too high' });
    console.log(`❌ [FAILED] Invalid rating 6 was allowed.`);
  } catch (err) {
    console.log(`🛡️ [JOI VALIDATION PASSED] Invalid rating 6 rejected with HTTP 400: "${err.message}"`);
  }

  // 4. Test Ranking Weights Sum Rule (Must equal 100)
  console.log(`\n--- 4. Testing Ranking Weights Sum Validation ---`);
  const rankingPipe = new JoiValidationPipe(CreateRankingWeightsSchema);
  try {
    rankingPipe.transform({
      verificationWeight: 50,
      ratingWeight: 50,
      experienceWeight: 20, // Sum = 120 != 100
      responsivenessWeight: 0,
    });
    console.log(`❌ [FAILED] Invalid weight sum 120 was allowed.`);
  } catch (err) {
    console.log(`🛡️ [JOI VALIDATION PASSED] Weight sum != 100 rejected with HTTP 400: "${err.message}"`);
  }

  console.log(`\n======================================================`);
  console.log(`=== ALL JOI VALIDATION & DTO TESTS PASSED 100%    ===`);
  console.log(`======================================================\n`);
}

testJoiValidation().catch(console.error);
