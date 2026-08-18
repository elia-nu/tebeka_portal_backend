import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/marketplace';

const prisma = new PrismaClient();

@Injectable()
export class SearchService {
  async searchAttorneys(query: any, userId?: string) {
    const startTime = Date.now();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {
      verifiedAt: { not: null },
    };

    if (query.q) {
      where.OR = [
        { city: { contains: query.q, mode: 'insensitive' } },
        { feeBand: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // Model-driven filters
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.feeBand) where.feeBand = query.feeBand;
    if (query.rating || query.minRating) where.rating = { gte: Number(query.rating || query.minRating) };
    if (query.minExperience) where.experienceScore = { gte: Number(query.minExperience) };
    if (query.minResponsiveness) where.responsivenessScore = { gte: Number(query.minResponsiveness) };
    if (query.practiceAreaId) where.practiceAreaIds = { has: query.practiceAreaId };
    if (query.language) where.languages = { has: query.language };

    // Dynamic sorting
    const allowedSortFields = ['searchScore', 'rating', 'experienceScore', 'responsivenessScore'];
    const sortBy = allowedSortFields.includes(query.sortBy) ? query.sortBy : 'searchScore';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      prisma.discoveryIndex.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.discoveryIndex.count({ where }),
    ]);

    const searchTimeMs = Date.now() - startTime;

    // Record SearchEvent
    await prisma.searchEvent.create({
      data: {
        userId: userId || null,
        filtersJson: query || {},
        resultsCount: total,
        searchTime: searchTimeMs,
      },
    }).catch(err => console.error('Failed to log SearchEvent:', err));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      searchTimeMs,
    };
  }

  async getSearchHistory(userId: string, query: any = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 20);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.searchEvent.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.searchEvent.count({ where: { userId } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async clearSearchHistory(userId: string) {
    await prisma.searchEvent.deleteMany({
      where: { userId },
    });
    return { status: 'success', message: 'Search history cleared successfully' };
  }
}
