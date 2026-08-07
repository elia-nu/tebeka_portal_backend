import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class SearchService {
  async searchUsers(query: any) {
    const q = query.q || '';
    const users = await prisma.user.findMany({
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
    const attorneys = await prisma.attorneyProfile.findMany({
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
    const q = (query.q || '').toLowerCase();
    const allAreas = [
      { id: 'pa-1', nameEn: 'Corporate Law', nameAm: 'የንግድ ሕግ', descriptionEn: 'Business & Commercial Law' },
      { id: 'pa-2', nameEn: 'Family Law', nameAm: 'የቤተሰብ ሕግ', descriptionEn: 'Divorce & Custody' },
      { id: 'pa-3', nameEn: 'Criminal Defense', nameAm: 'የወንጀል ሕግ', descriptionEn: 'Litigation & Defense' },
    ];
    const filtered = allAreas.filter(
      p => p.nameEn.toLowerCase().includes(q) || p.nameAm.includes(q)
    );
    return { query: q, count: filtered.length, results: filtered };
  }
}
