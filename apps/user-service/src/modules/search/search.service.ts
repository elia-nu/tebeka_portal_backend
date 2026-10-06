import { Injectable } from '@nestjs/common';
import { PrismaService } from '@workspace/database';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}
  async searchUsers(query: any) {
    const q = query.q || '';
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
    return { query: q, count: users.length, results: users };
  }

  async searchAttorneys(query: any) {
    const q = query.q || '';
    const attorneys = await this.prisma.attorneyProfile.findMany({
      where: {
        OR: [
          { city: { contains: q, mode: 'insensitive' } },
          { barRegistrationNumber: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { user: true },
      take: 20,
    });
    return { query: q, count: attorneys.length, results: attorneys };
  }

  async searchPracticeAreas(query: any) {
    const q = (query.q || '').trim();

    const where: any = {
      isActive: true,
    };

    if (q) {
      where.OR = [
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameAm: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
        { descriptionEn: { contains: q, mode: 'insensitive' } },
        { descriptionAm: { contains: q, mode: 'insensitive' } },
      ];
    }

    const results = await this.prisma.practiceArea.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return {
      query: q,
      count: results.length,
      results,
    };
  }
}
