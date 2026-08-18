const { PrismaClient: MarketplacePrisma, BookingStatus, CaseStatus } = require('@prisma/client/marketplace');
const { PrismaClient: UserPrisma } = require('@prisma/client');

const { BookingService } = require('../apps/marketplace-service/src/modules/booking/booking.service');
const { CaseService } = require('../apps/marketplace-service/src/modules/case/case.service');
const { ReviewService } = require('../apps/marketplace-service/src/modules/review/review.service');
const { DashboardService } = require('../apps/marketplace-service/src/modules/dashboard/dashboard.service');
const { AnalyticsService } = require('../apps/marketplace-service/src/modules/analytics/analytics.service');

async function testSRSImplementation() {
  console.log('================================================================');
  console.log('🚀 TESTING COMPLETE SRS v3.0 REMEDIATION SUITE (ALL MODULES)');
  console.log('================================================================\n');

  const marketplacePrisma = new MarketplacePrisma();
  const userPrisma = new UserPrisma();

  const testAttorneyId = '11111111-1111-1111-1111-111111111111';
  const testClientId = '22222222-2222-2222-2222-222222222222';

  try {
    // ----------------------------------------------------------------
    // 1. BOOKING RESCHEDULE PROPOSAL & NO-SHOW (FR-BOOK, BR-BOOK-04)
    // ----------------------------------------------------------------
    console.log('[1] Testing Booking Reschedule Proposal & Response (BR-BOOK-04)...');
    const bookingService = new BookingService();

    // Create a confirmed booking
    const booking = await marketplacePrisma.booking.create({
      data: {
        referenceNumber: `CONS-TEST-${Date.now()}`,
        clientId: testClientId,
        attorneyId: testAttorneyId,
        bookingDate: new Date(Date.now() + 86400000 * 2),
        startTime: '10:00',
        endTime: '11:00',
        consultationType: 'VIDEO',
        status: BookingStatus.CONFIRMED,
        paymentStatus: 'PAID'
      }
    });

    console.log(`   Created initial booking: ${booking.id} (${booking.referenceNumber})`);

    // Propose reschedule
    const proposal = await bookingService.proposeReschedule(
      booking.id,
      {
        proposedBookingDate: new Date(Date.now() + 86400000 * 3).toISOString(),
        proposedStartTime: '14:00',
        proposedEndTime: '15:00',
        reason: 'Court hearing rescheduled by magistrate'
      },
      testAttorneyId
    );

    console.log('   ✅ Reschedule proposal created. Expires at:', proposal.rescheduleExpiresAt);

    // Accept reschedule
    const acceptedBooking = await bookingService.respondToReschedule(
      booking.id,
      { action: 'ACCEPT' },
      testClientId
    );

    console.log('   ✅ Reschedule accepted! New startTime:', acceptedBooking.startTime, 'RescheduleCount:', acceptedBooking.rescheduleCount);

    // Test No-Show Reporting
    console.log('\n[2] Testing No-Show Reporting (FR-BOOK-06)...');
    const noShowBooking = await bookingService.reportNoShow(booking.id, testAttorneyId, 'Client did not connect to video room');
    console.log('   ✅ Booking marked as:', noShowBooking.status, 'Reason:', noShowBooking.noShowReason);

    // Test Availability Blackouts
    console.log('\n[3] Testing Availability Blackout / Vacation Dates (FR-PROF)...');
    const blackout = await bookingService.createBlackout(testAttorneyId, {
      startDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      endDate: new Date(Date.now() + 86400000 * 15).toISOString(),
      reason: 'Annual Legal Conference'
    });
    console.log('   ✅ Blackout date created:', blackout.id, 'Reason:', blackout.reason);

    // ----------------------------------------------------------------
    // 2. CASE MILESTONES & TIMELINE (FR-CASE-04, FR-CASE-05)
    // ----------------------------------------------------------------
    console.log('\n[4] Testing Case Milestones & Timeline Event Append (FR-CASE-04, FR-CASE-05)...');
    const caseService = new CaseService();
    const caseItem = await caseService.createCase({
      title: 'Intellectual Property Patent Infringement',
      description: 'Trademark and copyright violation dispute against unauthorized distributor.',
      attorneyId: testAttorneyId,
      priority: 'HIGH',
      opposingPartyName: 'MegaTech Distribution PLC',
      conflictAcknowledged: true
    }, testClientId);

    console.log('   Created case:', caseItem.id, caseItem.referenceNumber);

    // Create a new milestone
    const milestone = await caseService.createMilestone(caseItem.id, {
      title: 'Submit Injunction Brief to High Court',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString()
    }, testAttorneyId);
    console.log('   ✅ Milestone created:', milestone.id, milestone.title);

    // Update milestone status
    const updatedMilestone = await caseService.updateMilestoneStatus(caseItem.id, milestone.id, 'COMPLETED', testAttorneyId);
    console.log('   ✅ Milestone updated to:', updatedMilestone.status, 'CompletedAt:', updatedMilestone.completedAt);

    // Add Timeline event
    const timelineEvent = await caseService.addTimelineEvent(caseItem.id, {
      title: 'Document Discovery Submitted',
      description: 'Affidavits and forensic evidence lodged with registry'
    }, testAttorneyId);
    console.log('   ✅ Timeline event added:', timelineEvent.id, timelineEvent.title);

    // ----------------------------------------------------------------
    // 3. REVIEW REBUTTALS & MODERATION (FR-RATE-02, FR-RATE-04)
    // ----------------------------------------------------------------
    console.log('\n[5] Testing Review Rebuttal & Admin Moderation (FR-RATE-02, FR-RATE-04)...');
    const reviewService = new ReviewService();

    // Mark booking COMPLETED for review
    await marketplacePrisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.COMPLETED }
    });

    const review = await reviewService.createReview(booking.id, {
      rating: 4,
      comment: 'Very thorough legal guidance, but scheduling had a delay.'
    }, testClientId);
    console.log('   Created client review:', review.id, 'Rating:', review.rating);

    // Submit Attorney Rebuttal
    const rebuttedReview = await reviewService.submitRebuttal(
      review.id,
      'Thank you for the feedback. The slight delay was due to urgent magistrate proceedings, but we achieved the injunction!',
      testAttorneyId
    );
    console.log('   ✅ Attorney Rebuttal Submitted:', rebuttedReview.rebuttal);

    // Admin Moderation
    const moderatedReview = await reviewService.updateModerationStatus(review.id, 'PUBLISHED', 'admin-mod-1');
    console.log('   ✅ Admin Moderation Status:', moderatedReview.status);

    // ----------------------------------------------------------------
    // 4. PRACTICE DASHBOARD & ANALYTICS (FR-DASH, FR-ANLYT)
    // ----------------------------------------------------------------
    console.log('\n[6] Testing Practice Dashboard Aggregator & Analytics (FR-DASH, FR-ANLYT)...');
    const dashboardService = new DashboardService();
    const dashboard = await dashboardService.getAttorneyDashboardSummary(testAttorneyId);
    console.log('   ✅ Dashboard Aggregator Summary:', dashboard.summary);

    const analyticsService = new AnalyticsService();
    const overview = await analyticsService.getOverviewAnalytics();
    console.log('   ✅ Analytics Total Bookings:', overview.overview.totalBookings, 'Total Cases:', overview.overview.totalCases);

    // ----------------------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------------------
    await marketplacePrisma.reviewReport.deleteMany({ where: { reviewId: review.id } });
    await marketplacePrisma.review.deleteMany({ where: { id: review.id } });
    await marketplacePrisma.availabilityBlackout.deleteMany({ where: { id: blackout.id } });
    await marketplacePrisma.caseTimeline.deleteMany({ where: { caseId: caseItem.id } });
    await marketplacePrisma.caseMilestone.deleteMany({ where: { caseId: caseItem.id } });
    await marketplacePrisma.outboxEvent.deleteMany({ where: { aggregateId: caseItem.id } });
    await marketplacePrisma.case.delete({ where: { id: caseItem.id } });
    await marketplacePrisma.bookingEvent.deleteMany({ where: { bookingId: booking.id } });
    await marketplacePrisma.bookingTimeline.deleteMany({ where: { bookingId: booking.id } });
    await marketplacePrisma.outboxEvent.deleteMany({ where: { aggregateId: booking.id } });
    await marketplacePrisma.booking.delete({ where: { id: booking.id } });

    console.log('\n================================================================');
    console.log('🎉 ALL SRS v3.0 GAP REMEDIATION SUITE TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    await marketplacePrisma.$disconnect();
    await userPrisma.$disconnect();
  }
}

testSRSImplementation().catch((err) => {
  console.error('❌ SRS Verification Suite Error:', err);
  process.exit(1);
});
