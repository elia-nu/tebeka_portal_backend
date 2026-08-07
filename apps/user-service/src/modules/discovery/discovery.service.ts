import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface QuestionnaireInput {
  matterType: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  language: string;
  budgetBand: string;
}

@Injectable()
export class DiscoveryService {
  private calculateRankingScore(attorney: any, weights = { verification: 30, responsiveness: 25, rating: 25, experience: 20 }) {
    // Total weights invariant check
    const totalWeight = weights.verification + weights.responsiveness + weights.rating + weights.experience;
    if (totalWeight !== 100) {
      throw new BadRequestException('Ranking weights must total exactly 100%');
    }

    const verificationPart = attorney.hasVerifiedBadge ? 100 : 50;
    const responsivenessPart = Math.min(100, attorney.responsivenessScore || 0);
    const ratingPart = ((attorney.rating || 0) / 5) * 100;
    const experiencePart = Math.min(100, (attorney.experienceYears || 0) * 5); // 20 yrs = 100%

    const score = (
      (verificationPart * weights.verification) +
      (responsivenessPart * weights.responsiveness) +
      (ratingPart * weights.rating) +
      (experiencePart * weights.experience)
    ) / 100;

    return Number(score.toFixed(2));
  }

  private maskSurname(name?: string | null): string {
    if (!name) return 'Attorney';
    const parts = name.trim().split(' ');
    if (parts.length <= 1) return name;
    const firstName = parts[0];
    const surnameInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${surnameInitial}.`;
  }

  async getPublicAttorneys(query: any, isAnonymous = false) {
    const page = Number(query.page) || 1;
    let limit = Number(query.limit) || 20;

    // Anonymous Preview Limit: Max 3 results
    if (isAnonymous) {
      limit = Math.min(limit, 3);
    }

    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    };

    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.feeBand) where.feeBand = query.feeBand;
    if (query.rating) where.rating = { gte: Number(query.rating) };
    if (query.videoSupport) where.videoSupport = query.videoSupport === 'true';

    const [items, total] = await Promise.all([
      prisma.attorneyProfile.findMany({
        where,
        skip,
        take: limit,
        include: { user: true, educations: true },
      }),
      prisma.attorneyProfile.count({ where }),
    ]);

    // Apply ranking algorithm (NO paid boosting allowed)
    const rankedItems = items
      .map(attorney => {
        const rankingScore = this.calculateRankingScore(attorney);
        const displayName = isAnonymous 
          ? this.maskSurname(attorney.user?.name || attorney.user?.displayName)
          : (attorney.user?.name || attorney.user?.displayName || 'Attorney');

        return {
          id: attorney.id,
          slug: attorney.slug,
          displayName,
          city: attorney.city,
          officeAddress: isAnonymous ? 'Masked for unauthenticated visitors' : attorney.officeAddress,
          experienceYears: attorney.experienceYears,
          rating: attorney.rating,
          reviewCount: attorney.reviewCount,
          feeBand: attorney.feeBand,
          hasVerifiedBadge: attorney.hasVerifiedBadge,
          rankingScore,
          paidPromotion: false, // Invariant: No paid promotion allowed
          contactActionsDisabled: isAnonymous
        };
      })
      .sort((a, b) => b.rankingScore - a.rankingScore);

    return {
      items: rankedItems,
      total: isAnonymous ? Math.min(total, 3) : total,
      page,
      limit,
      totalPages: Math.ceil((isAnonymous ? Math.min(total, 3) : total) / limit),
      anonymousPreviewNotice: isAnonymous ? {
        message: 'Viewing anonymous preview (max 3 results). Please register or sign in to see full profile details and contact attorneys.',
        promptRegistration: true
      } : null
    };
  }

  // 5-Step Guided Questionnaire
  async processQuestionnaire(input: QuestionnaireInput, isAnonymous = false) {
    const query: any = {
      feeBand: input.budgetBand,
      city: input.location,
    };

    const results = await this.getPublicAttorneys(query, isAnonymous);

    return {
      questionnaireSummary: input,
      matchedAttorneys: results
    };
  }

  async getRankingExplanation() {
    return {
      title: 'How Attorney Search Results are Ranked',
      titleAm: 'የጠበቆች ፍለጋ ውጤቶች እንዴት እንደሚመደቡ',
      methodology: 'Our ranking engine uses a 100% transparent, 4-factor objective formula with strict non-paid invariants.',
      factors: [
        { name: 'Verification Level', weight: '30%', description: 'Verified bar standing and credentials' },
        { name: 'Responsiveness Score', weight: '25%', description: 'Historical client response time and booking confirmation rate' },
        { name: 'Client Rating', weight: '25%', description: 'Average review score from verified completed client consultations' },
        { name: 'Years of Experience', weight: '20%', description: 'Verified years of legal practice experience' }
      ],
      invariants: [
        'No paid promotion or sponsored placement',
        'No manual administrator override or manual reordering',
        'Equal weighting rules applied objectively across all attorneys'
      ]
    };
  }

  async getPublicAttorneyBySlug(slug: string) {
    const attorney = await prisma.attorneyProfile.findFirst({
      where: {
        OR: [{ slug }, { id: slug }],
        status: 'ACTIVE',
        verificationStatus: 'APPROVED'
      },
      include: { user: true, educations: true, credentials: true },
    });

    if (!attorney) throw new NotFoundException(`Attorney with slug/ID ${slug} not found or not currently active`);
    return attorney;
  }

  async getSearchIndexProjection() {
    const activeAttorneys = await prisma.attorneyProfile.findMany({
      where: { status: 'ACTIVE', verificationStatus: 'APPROVED' },
      include: { user: true },
    });

    return activeAttorneys.map(a => ({
      attorneyId: a.id,
      city: a.city,
      languages: a.languages,
      feeBand: a.feeBand,
      rating: a.rating,
      responsivenessScore: a.responsivenessScore,
      experienceScore: a.experienceYears * 10,
      rankingScore: this.calculateRankingScore(a),
      hasVerifiedBadge: a.hasVerifiedBadge,
      updatedAt: a.updatedAt,
    }));
  }
}
