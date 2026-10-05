import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { BookingStatus, ReviewStatus } from '@prisma/client/marketplace';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}
  async createReview(bookingId: string, data: any, clientId: string) {
    if (!data.rating || data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    // Strict Interactive Transaction: All reads, validations, writes, and event emission inside tx
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException(`Booking ${bookingId} not found`);
      }

      if (booking.clientId !== clientId) {
        throw new BadRequestException('Only the client who made this booking can submit a review.');
      }

      if (booking.status !== BookingStatus.COMPLETED) {
        throw new BadRequestException('Reviews can only be submitted for COMPLETED consultations.');
      }

      const existingReview = await tx.review.findUnique({
        where: { bookingId },
      });

      if (existingReview) {
        throw new ConflictException('A review has already been submitted for this booking.');
      }

      const review = await tx.review.create({
        data: {
          bookingId,
          clientId,
          attorneyId: booking.attorneyId,
          rating: Number(data.rating),
          comment: data.comment || null,
          status: ReviewStatus.PUBLISHED,
        },
      });

      // Recalculate attorney rating on DiscoveryIndex inside tx
      const reviews = await tx.review.findMany({
        where: { attorneyId: booking.attorneyId, status: ReviewStatus.PUBLISHED },
        select: { rating: true },
      });

      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

      await tx.discoveryIndex.updateMany({
        where: { attorneyId: booking.attorneyId },
        data: { rating: Number(avgRating.toFixed(2)) },
      });

      // Persist OutboxEvent inside tx
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Review',
          aggregateId: review.id,
          eventType: 'REVIEW_CREATED',
          payload: {
            reviewId: review.id,
            bookingId,
            attorneyId: booking.attorneyId,
            clientId,
            rating: review.rating,
          },
        },
      });

      return review;
    });
  }

  async getAttorneyReviews(attorneyId: string, query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = { attorneyId };

    // Model-driven filters
    if (query.clientId) where.clientId = query.clientId;
    if (query.status) where.status = query.status;
    else where.status = ReviewStatus.PUBLISHED;

    if (query.rating) where.rating = Number(query.rating);
    else if (query.minRating) where.rating = { gte: Number(query.minRating) };

    // Dynamic sorting
    const allowedSortFields = ['createdAt', 'rating'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.review.count({ where }),
    ]);

    const avgRating = total > 0 ? (items.reduce((sum, r) => sum + r.rating, 0) / items.length).toFixed(2) : 0;

    return { items, total, averageRating: Number(avgRating), page, limit, totalPages: Math.ceil(total / limit) };
  }

  async submitRebuttal(reviewId: string, rebuttalText: string, attorneyId: string) {
    if (!rebuttalText || !rebuttalText.trim()) {
      throw new BadRequestException('Rebuttal response text is required');
    }

    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);

    if (review.attorneyId !== attorneyId) {
      throw new BadRequestException('Only the reviewed attorney can submit a rebuttal response.');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        rebuttal: rebuttalText.trim(),
        rebuttalAt: new Date(),
      },
    });
  }

  async updateModerationStatus(reviewId: string, status: ReviewStatus, adminId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);

    return this.prisma.review.update({
      where: { id: reviewId },
      data: { status },
    });
  }

  async reportReview(reviewId: string, data: { reason: string }, reportedBy: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);

    return this.prisma.reviewReport.create({
      data: {
        reviewId,
        reportedBy,
        reason: data.reason || 'Flagged for moderation review',
      },
      include: {
        review: true,
      },
    });
  }

  async getReviewReports(query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.reviewId) where.reviewId = query.reviewId;
    if (query.reportedBy) where.reportedBy = query.reportedBy;

    const allowedSortFields = ['createdAt', 'status'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.reviewReport.findMany({
        where,
        skip,
        take: limit,
        include: {
          review: {
            include: {
              booking: {
                select: {
                  id: true,
                  referenceNumber: true,
                  clientId: true,
                  attorneyId: true,
                  bookingDate: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.reviewReport.count({ where }),
    ]);

    // Calculate 1 business day SLA tracking per SRS FR-ADMIN-03
    const now = Date.now();
    const formattedItems = items.map((item) => {
      const createdAtMs = new Date(item.createdAt).getTime();
      // 1 business day (24 hours) SLA target for moderation
      const slaDeadline = new Date(createdAtMs + 24 * 60 * 60 * 1000);
      const isBreached = item.status === 'PENDING' && now > slaDeadline.getTime();
      const remainingMs = Math.max(0, slaDeadline.getTime() - now);

      return {
        ...item,
        sla: {
          targetBusinessDays: 1,
          slaDeadline,
          isBreached,
          remainingHours: item.status === 'PENDING' ? Math.round(remainingMs / (1000 * 60 * 60)) : 0,
        },
      };
    });

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        pendingCount: await this.prisma.reviewReport.count({ where: { status: 'PENDING' } }),
        actionedCount: await this.prisma.reviewReport.count({ where: { status: 'ACTIONED' } }),
        dismissedCount: await this.prisma.reviewReport.count({ where: { status: 'DISMISSED' } }),
      },
    };
  }

  async updateReviewReport(reportId: string, data: any, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.reviewReport.findUnique({
        where: { id: reportId },
        include: { review: true },
      });

      if (!report) {
        throw new NotFoundException(`Review report ${reportId} not found`);
      }

      const updatedReport = await tx.reviewReport.update({
        where: { id: reportId },
        data: {
          status: data.status,
          actionTaken: data.actionTaken || null,
          adminNotes: data.adminNotes || null,
          resolvedBy: adminId,
          resolvedAt: new Date(),
        },
      });

      if (data.reviewStatus && report.reviewId) {
        await tx.review.update({
          where: { id: report.reviewId },
          data: { status: data.reviewStatus },
        });
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'ReviewReport',
          aggregateId: reportId,
          eventType: 'REVIEW_REPORT_MODERATED',
          payload: {
            reportId,
            reviewId: report.reviewId,
            status: data.status,
            actionTaken: data.actionTaken,
            adminId,
            reviewStatus: data.reviewStatus,
          },
        },
      });

      return updatedReport;
    });
  }
}
