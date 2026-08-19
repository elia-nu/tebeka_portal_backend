import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaClient, BookingStatus, CaseStatus, Priority } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class DashboardService {
  async getAttorneyDashboardSummary(attorneyId: string) {
    if (!attorneyId) {
      throw new BadRequestException('Attorney ID is required to fetch practice dashboard summary');
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      pendingBookingsCount,
      confirmedBookingsCount,
      todayBookings,
      activeCasesCount,
      urgentCasesCount,
      totalCompletedBookings,
      reviews,
      recentCases
    ] = await Promise.all([
      // 1. Pending consultations awaiting attorney response
      prisma.booking.count({
        where: { attorneyId, status: { in: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED_PENDING_PAYMENT] } }
      }),

      // 2. Confirmed upcoming consultations
      prisma.booking.count({
        where: {
          attorneyId,
          status: BookingStatus.CONFIRMED,
          bookingDate: { gte: startOfToday }
        }
      }),

      // 3. Today's scheduled bookings
      prisma.booking.findMany({
        where: {
          attorneyId,
          bookingDate: { gte: startOfToday, lte: endOfToday }
        },
        orderBy: { startTime: 'asc' }
      }),

      // 4. Active open cases
      prisma.case.count({
        where: {
          attorneyId,
          status: { in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS, CaseStatus.PENDING_REVIEW] }
        }
      }),

      // 5. Urgent cases / deadline-sensitive cases
      prisma.case.count({
        where: {
          attorneyId,
          status: { in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS] },
          OR: [
            { priority: Priority.URGENT },
            { timeSensitiveDate: { gte: startOfToday } }
          ]
        }
      }),

      // 6. Total completed consultations
      prisma.booking.count({
        where: { attorneyId, status: BookingStatus.COMPLETED }
      }),

      // 7. Client reviews rating summary
      prisma.review.findMany({
        where: { attorneyId, status: 'PUBLISHED' },
        take: 5,
        orderBy: { createdAt: 'desc' }
      }),

      // 8. Recent active cases list
      prisma.case.findMany({
        where: { attorneyId },
        take: 5,
        orderBy: { openedAt: 'desc' },
        include: { caseMilestones: true }
      })
    ]);

    // Compute average rating from published reviews
    const totalRatingSum = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = reviews.length > 0 ? Number((totalRatingSum / reviews.length).toFixed(2)) : 5.0;

    return {
      status: 'success',
      attorneyId,
      summary: {
        pendingConsultationsCount: pendingBookingsCount,
        upcomingBookingsCount: confirmedBookingsCount,
        activeCasesCount,
        urgentCasesCount,
        totalCompletedBookings,
        averageRating,
        reviewCount: reviews.length
      },
      todaySchedule: todayBookings,
      recentCases,
      recentReviews: reviews
    };
  }
}
