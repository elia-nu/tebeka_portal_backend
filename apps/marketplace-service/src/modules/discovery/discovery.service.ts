import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/marketplace';
import { UserServiceClient } from '../../integrations/user-service.client';

const prisma = new PrismaClient();

@Injectable()
export class DiscoveryService {
  constructor(private readonly userServiceClient: UserServiceClient) {}

  private maskSurname(name?: string | null): string {
    if (!name) return 'Attorney';
    const parts = name.trim().split(' ');
    if (parts.length <= 1) return name;
    const firstName = parts[0];
    const surnameInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${surnameInitial}.`;
  }

  async getPublicAttorneys(query: any, isAnonymous = false) {
    const page = Math.max(1, Number(query.page) || 1);
    let limit = Math.max(1, Number(query.limit) || 20);

    // Anonymous Preview Limit: Max 3 results
    if (isAnonymous) {
      limit = Math.min(limit, 3);
    }

    const skip = (page - 1) * limit;

    const where: any = {
      verifiedAt: { not: null }, // Only verified attorneys
    };

    // Model-driven filtering
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

    const formattedItems = items.map(item => ({
      ...item,
      name: isAnonymous ? this.maskSurname('Attorney User') : 'Attorney User',
      isAnonymousPreview: isAnonymous,
    }));

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ...(isAnonymous && {
        message: 'Viewing anonymous preview (max 3 results). Please sign in for full attorney details.',
      }),
    };
  }

  async getAttorneyDetails(attorneyId: string) {
    const discovery = await prisma.discoveryIndex.findUnique({
      where: { attorneyId },
    });

    if (!discovery || !discovery.verifiedAt) {
      throw new NotFoundException(`Verified attorney profile with ID ${attorneyId} not found`);
    }

    // Fetch live projection from User Service via HTTP integration
    const userServiceProfile = await this.userServiceClient.getAttorneyProfile(attorneyId);

    const availability = await prisma.availabilityWindow.findMany({
      where: { attorneyId, isAvailable: true },
    });

    return {
      ...discovery,
      userProfile: userServiceProfile || { id: attorneyId, note: 'User Service integration active' },
      availability,
    };
  }
}
