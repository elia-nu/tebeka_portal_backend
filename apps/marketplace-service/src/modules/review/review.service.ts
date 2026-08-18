import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, BookingStatus, ReviewStatus } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class ReviewService {
  async createReview(bookingId: string, data: any, clientId: string) {
    if (!data.rating || data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    // Strict Interactive Transaction: All reads, validations, writes, and event emission inside tx
    return prisma.$transaction(async (tx) => {
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
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.review.count({ where }),
    ]);

    const avgRating = total > 0 ? (items.reduce((sum, r) => sum + r.rating, 0) / items.length).toFixed(2) : 0;

    return { items, total, averageRating: Number(avgRating), page, limit, totalPages: Math.ceil(total / limit) };
  }

  async submitRebuttal(reviewId: string, rebuttalText: string, attorneyId: string) {
    if (!rebuttalText || !rebuttalText.trim()) {
      throw new BadRequestException('Rebuttal response text is required');
    }

    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);

    if (review.attorneyId !== attorneyId) {
      throw new BadRequestException('Only the reviewed attorney can submit a rebuttal response.');
    }

    return prisma.review.update({
      where: { id: reviewId },
      data: {
        rebuttal: rebuttalText.trim(),
        rebuttalAt: new Date(),
      },
    });
  }

  async updateModerationStatus(reviewId: string, status: ReviewStatus, adminId: string) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);

    return prisma.review.update({
      where: { id: reviewId },
      data: { status },
    });
  }

  async reportReview(reviewId: string, data: { reason: string }, reportedBy: string) {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException(`Review ${reviewId} not found`);

    return prisma.reviewReport.create({
      data: {
        reviewId,
        reportedBy,
        reason: data.reason || 'Flagged for moderation review',
      },
    });
  }
}
