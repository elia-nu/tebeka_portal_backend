import { Injectable } from '@nestjs/common';
import { PrismaClient, BookingStatus, CaseStatus } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class AnalyticsService {
  async getOverviewAnalytics() {
    const [
      totalBookings,
      totalCases,
      totalReviews,
      totalPracticeAreas,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      openCases,
      inProgressCases,
      closedCases
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.case.count(),
      prisma.review.count(),
      prisma.practiceArea.count(),
      prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
      prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
      prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
      prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
      prisma.case.count({ where: { status: CaseStatus.OPEN } }),
      prisma.case.count({ where: { status: CaseStatus.IN_PROGRESS } }),
      prisma.case.count({ where: { status: CaseStatus.CLOSED } })
    ]);

    return {
      status: 'success',
      timestamp: new Date().toISOString(),
      overview: {
        totalBookings,
        totalCases,
        totalReviews,
        totalPracticeAreas
      },
      bookingsDistribution: {
        pending: pendingBookings,
        confirmed: confirmedBookings,
        completed: completedBookings,
        cancelled: cancelledBookings
      },
      casesDistribution: {
        open: openCases,
        inProgress: inProgressCases,
        closed: closedCases
      }
    };
  }

  async getAttorneyAnalytics() {
    const discoveryItems = await prisma.discoveryIndex.findMany({
      take: 20,
      orderBy: { searchScore: 'desc' }
    });

    return {
      status: 'success',
      totalIndexedAttorneys: discoveryItems.length,
      topAttorneys: discoveryItems
    };
  }

  async getBookingAnalytics() {
    const [inPersonCount, videoCount, phoneCount] = await Promise.all([
      prisma.booking.count({ where: { consultationType: 'IN_PERSON' } }),
      prisma.booking.count({ where: { consultationType: 'VIDEO' } }),
      prisma.booking.count({ where: { consultationType: 'PHONE' } })
    ]);

    return {
      status: 'success',
      consultationTypes: {
        IN_PERSON: inPersonCount,
        VIDEO: videoCount,
        PHONE: phoneCount
      }
    };
  }

  async getRevenueAnalytics() {
    const paidBookings = await prisma.booking.count({ where: { paymentStatus: 'PAID' } });
    const estimatedVolume = paidBookings * 1500;
    const estimatedPlatformCommission = estimatedVolume * 0.15;

    return {
      status: 'success',
      paidBookingsCount: paidBookings,
      estimatedVolumeETB: estimatedVolume,
      estimatedPlatformCommissionETB: estimatedPlatformCommission,
      currency: 'ETB'
    };
  }
}
