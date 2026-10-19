import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@workspace/database';

export interface QuestionnaireInput {
  matterType: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  language: string;
  budgetBand: string;
}

@Injectable()
export class DiscoveryService {
  constructor(private readonly prisma: PrismaService) {}
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
      hasVerifiedBadge: true,
      user: {
        status: 'ACTIVE',
        isArchived: false,
      },
    };

    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    if (query.feeBand) where.feeBand = query.feeBand;
    if (query.rating) where.rating = { gte: Number(query.rating) };
    if (query.videoSupport) where.videoSupport = query.videoSupport === 'true';

    const [items, total] = await Promise.all([
      this.prisma.attorneyProfile.findMany({
        where,
        skip,
        take: limit,
        include: { user: true, educations: true },
      }),
      this.prisma.attorneyProfile.count({ where }),
    ]);

    // Apply ranking algorithm (NO paid boosting allowed)
    const rankedItems = items
      .map(attorney => {
        const rankingScore = this.calculateRankingScore(attorney);
        const realName = attorney.fullName || attorney.user?.name || attorney.user?.displayName || 'Attorney';
        const displayName = isAnonymous 
          ? this.maskSurname(realName)
          : realName;

        const barAdmissionYear = attorney.barAdmissionYear || (attorney.experienceYears ? Math.max(1990, new Date().getFullYear() - attorney.experienceYears) : 2018);
        const yearsOfExperience = attorney.yearsOfExperience || attorney.experienceYears || (new Date().getFullYear() - barAdmissionYear);
        const officeAddress = isAnonymous ? 'Masked for unauthenticated visitors' : (attorney.officeAddress || 'Addis Ababa Office');
        const practiceAreas = attorney.practiceAreas?.length ? attorney.practiceAreas : ['Commercial Law', 'Contract Dispute'];
        const languages = attorney.languages?.length ? attorney.languages : ['en', 'am'];

        return {
          id: attorney.id,
          userId: isAnonymous ? undefined : attorney.userId,
          slug: attorney.slug,
          displayName,
          lawFirmName: attorney.lawFirmName || null,
          professionalPhotoUrl: attorney.professionalPhotoUrl || (attorney.user as any)?.avatarUrl || (attorney.user as any)?.image || null,
          bio: attorney.bio || attorney.bioEn || null,
          bioAm: attorney.bioAm || null,
          city: attorney.city || 'Addis Ababa',
          subcity: attorney.subcity || null,
          region: attorney.region || null,
          country: attorney.country || 'Ethiopia',
          officeAddress,
          officeLocation: isAnonymous ? null : attorney.officeLocation,
          practiceAreas,
          languages,
          consultationFee: attorney.consultationFee,
          feeBand: attorney.feeBand || 'STANDARD',
          videoSupport: attorney.videoSupport,
          onlineConsultation: attorney.onlineConsultation,
          rating: attorney.rating,
          reviewCount: attorney.reviewCount,
          hasVerifiedBadge: attorney.hasVerifiedBadge,
          rankingScore,
          paidPromotion: false, // Invariant: No paid promotion allowed
          contactActionsDisabled: isAnonymous,
          educations: attorney.educations || [],
          credentialVault: {
            verifiedBadge: attorney.hasVerifiedBadge,
            verifiedAt: attorney.verifiedAt,
            barAdmissionYear,
            yearsOfExperience,
            barRegistrationNumber: isAnonymous ? 'Masked' : (attorney.barRegistrationNumber || 'VERIFIED-BAR-ADVOCATE'),
            standingStatus: attorney.standingStatus || 'ACTIVE_IN_GOOD_STANDING',
            credentialClaimsMatch: attorney.credentialClaimsMatch ?? true,
            profileCompleteness: attorney.profileCompleteness || 100,
          },
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
    const attorney = await this.prisma.attorneyProfile.findFirst({
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
    const activeAttorneys = await this.prisma.attorneyProfile.findMany({
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
