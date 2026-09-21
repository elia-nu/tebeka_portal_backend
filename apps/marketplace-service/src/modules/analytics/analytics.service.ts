import { Injectable } from '@nestjs/common';
import { BookingStatus, CaseStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}
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
      this.prisma.booking.count(),
      this.prisma.case.count(),
      this.prisma.review.count(),
      this.prisma.practiceArea.count(),
      this.prisma.booking.count({ where: { status: { in: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED_PENDING_PAYMENT] } } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
      this.prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
      this.prisma.case.count({ where: { status: CaseStatus.OPEN } }),
      this.prisma.case.count({ where: { status: CaseStatus.IN_PROGRESS } }),
      this.prisma.case.count({ where: { status: CaseStatus.CLOSED } })
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
    const discoveryItems = await this.prisma.discoveryIndex.findMany({
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
      this.prisma.booking.count({ where: { consultationType: 'IN_PERSON' } }),
      this.prisma.booking.count({ where: { consultationType: 'VIDEO' } }),
      this.prisma.booking.count({ where: { consultationType: 'PHONE' } })
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
    const paidBookings = await this.prisma.booking.count({ where: { paymentStatus: 'PAID' } });
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
