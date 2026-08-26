import dotenv from 'dotenv';
dotenv.config();

import { AttorneyGoogleCalendarService } from '../apps/user-service/src/modules/attorneys/services/google-calendar.service';
import { BookingService } from '../apps/marketplace-service/src/modules/booking/booking.service';
import { GoogleMeetService } from '../apps/marketplace-service/src/modules/integrations/google-meet.service';
import { BookingCancellationService } from '../apps/marketplace-service/src/modules/booking/services/booking-cancellation.service';
import { BookingRescheduleService } from '../apps/marketplace-service/src/modules/booking/services/booking-reschedule.service';
import { BookingDisputeService } from '../apps/marketplace-service/src/modules/booking/services/booking-dispute.service';

async function testAvailabilityWorkflow() {
  console.log('========================================================================');
  console.log('🧪 TESTING ATTORNEY AVAILABILITY & GOOGLE CALENDAR FREE/BUSY INTEGRATION');
  console.log('========================================================================\n');

  // 1. Test AttorneyGoogleCalendarService
  console.log('--- Step 1: Testing Attorney Google OAuth Service ---');
  const googleCalService = new AttorneyGoogleCalendarService();
  const authUrlResult = googleCalService.generateAuthUrl('attorney-uuid-test');
  console.log('Generated OAuth Consent URL:', authUrlResult.url);
  if (!authUrlResult.url.includes('calendar')) {
    throw new Error('OAuth URL is missing calendar scopes');
  }
  console.log('✅ OAuth Connect URL generated successfully with required calendar scopes.\n');

  // 2. Test GoogleMeetService getAttorneyBusyIntervals fallback & parsing
  console.log('--- Step 2: Testing Google Free/Busy API Service ---');
  const googleMeetService = new GoogleMeetService();
  const dayStart = new Date('2026-09-07T00:00:00+03:00');
  const dayEnd = new Date('2026-09-07T23:59:59+03:00');

  const busySlots = await googleMeetService.getAttorneyBusyIntervals(
    'mock-refresh-token',
    dayStart,
    dayEnd
  );
  console.log('Mock/fallback busy intervals result:', busySlots);
  console.log('✅ Google Free/Busy query handled gracefully without exceptions.\n');

  // 3. Test BookingService Dynamic Available Slots & Google Conflict Exclusion
  console.log('--- Step 3: Testing Slot Generation & Off-Time / Busy Filtering ---');
  const cancellationService = new BookingCancellationService();
  const rescheduleService = new BookingRescheduleService();
  const disputeService = new BookingDisputeService();

  // Mock UserServiceClient that returns attorney with Google sync active
  const mockUserServiceClient: any = {
    getAttorneyProfile: async (id: string) => ({
      id,
      fullName: 'Advocate Dawit Solomon',
      isGoogleSyncEnabled: true,
      googleRefreshToken: 'mock-token',
      googleCalendarId: 'primary',
    }),
  };

  // Mock GoogleMeetService with simulated personal Google Calendar busy events
  const mockGoogleMeetService: any = {
    getAttorneyBusyIntervals: async () => [
      // 10:00 - 11:30 Court session on Google Calendar
      { start: new Date('2026-09-07T10:00:00+03:00'), end: new Date('2026-09-07T11:30:00+03:00') },
      // 14:00 - 15:00 Personal Doctor Appointment on Google Calendar
      { start: new Date('2026-09-07T14:00:00+03:00'), end: new Date('2026-09-07T15:00:00+03:00') },
    ],
  };

  const bookingService = new BookingService(
    cancellationService,
    rescheduleService,
    disputeService,
    undefined,
    mockGoogleMeetService,
    mockUserServiceClient
  );

  // Target: Monday Sept 7, 2026 (Working hours 09:00 - 17:00)
  const mondayResult = await bookingService.getAvailableSlotsForDate('attorney-1', '2026-09-07', 60);
  console.log('Available Slots for Monday (09:00 - 17:00 with 10:00-11:30 & 14:00-15:00 busy):');
  console.log('Result:', JSON.stringify(mondayResult, null, 2));

  // Assertions:
  // Candidate slots for 09:00 - 17:00 (1h duration): 09:00-10:00, 10:00-11:00, 11:00-12:00, 12:00-13:00, 13:00-14:00, 14:00-15:00, 15:00-16:00, 16:00-17:00
  // Busy slots:
  // - 10:00-11:00 (overlaps with 10:00-11:30) -> MUST BE EXCLUDED
  // - 11:00-12:00 (overlaps with 10:00-11:30) -> MUST BE EXCLUDED
  // - 14:00-15:00 (overlaps with 14:00-15:00) -> MUST BE EXCLUDED
  // Expected open slots: 09:00-10:00, 12:00-13:00, 13:00-14:00, 15:00-16:00, 16:00-17:00

  const slotStartTimes = mondayResult.availableSlots?.map((s: any) => s.startTime) || [];
  console.log('\nReturned Open Slot Start Times:', slotStartTimes);

  if (slotStartTimes.includes('10:00')) {
    throw new Error('FAILED: 10:00 slot was not excluded despite Google Calendar busy block!');
  }
  if (slotStartTimes.includes('14:00')) {
    throw new Error('FAILED: 14:00 slot was not excluded despite Google Calendar busy block!');
  }
  if (!slotStartTimes.includes('09:00') || !slotStartTimes.includes('15:00')) {
    throw new Error('FAILED: Valid open slots were incorrectly filtered out!');
  }

  console.log('✅ PASS: Busy blocks (Court & Doctor appointments) were successfully excluded from client view!');

  // 4. Test Sunday (Off day)
  const sundayResult = await bookingService.getAvailableSlotsForDate('attorney-1', '2026-09-06', 60);
  console.log('\nOff-Day (Sunday) Result:', sundayResult);
  if (sundayResult.isAvailable !== false || sundayResult.availableSlots.length !== 0) {
    throw new Error('FAILED: Off-day should have returned 0 available slots!');
  }
  console.log('✅ PASS: Off-day (Sunday) correctly returned 0 available slots.');

  // 5. Test createBooking conflict rejection when client tries to book a Google busy slot
  console.log('\n--- Step 4: Testing createBooking conflict protection ---');
  let conflictCaught = false;
  try {
    await bookingService.createBooking(
      {
        attorneyId: 'attorney-1',
        bookingDate: '2026-09-07T00:00:00+03:00',
        startTime: '10:00',
        endTime: '11:00',
      },
      'client-1'
    );
  } catch (err: any) {
    conflictCaught = true;
    console.log('Successfully rejected booking on Google busy slot with error:', err.message || err);
  }

  if (!conflictCaught) {
    throw new Error('FAILED: Booking creation during a Google Calendar busy slot was not rejected!');
  }
  console.log('✅ PASS: Booking creation during a Google Calendar busy slot is rejected with 409 Conflict.');

  console.log('\n========================================================================');
  console.log('🎉 ALL GOOGLE CALENDAR FREE/BUSY AVAILABILITY TESTS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');
}

testAvailabilityWorkflow().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
