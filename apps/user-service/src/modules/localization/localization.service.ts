import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { validateCatalogKey, validateCatalogValue, formatEtb, formatEatDateTime } from '@workspace/localization';
import { CreateUpdateStringDto } from './dto/create-update-string.dto';
import { RecordReviewDto, ReviewDecision } from './dto/record-review.dto';

export enum I18nStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  LEGAL_REVIEW = 'LEGAL_REVIEW',
  PUBLISHED = 'PUBLISHED',
}

export enum I18nReviewDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
}

const prisma = new PrismaClient();

@Injectable()
export class LocalizationService {
  private readonly logger = new Logger(LocalizationService.name);

  /**
   * Returns list of supported platform languages.
   */
  async getLanguages() {
    return [
      { code: 'en', name: 'English', direction: 'LTR', isDefault: true, isActive: true },
      { code: 'am', name: 'Amharic (አማርኛ)', direction: 'LTR', isDefault: false, isActive: true },
    ];
  }

  /**
   * Updates default language preference.
   */
  async updateDefaultLanguage(data: { code: string }) {
    if (!['en', 'am'].includes(data.code)) {
      throw new BadRequestException(`Unsupported language code: ${data.code}`);
    }
    return { status: 'success', defaultLanguage: data.code };
  }

  /**
   * GET /api/v1/i18n/catalog/:locale?ns=&v=
   * Public CDN-cached catalog endpoint (FR-LOC-01).
   * Resolves fallback chain (am -> en) and logs missing gaps to backlog.
   */
  async getPublishedCatalog(locale: string, namespace?: string, version?: number) {
    const targetLocale = (locale || 'en').toLowerCase();
    const whereNs = namespace ? { namespace } : {};

    // 1. Fetch published strings for target locale
    const targetStrings = await prisma.i18nString.findMany({
      where: {
        locale: targetLocale,
        status: I18nStatus.PUBLISHED,
        ...whereNs,
      },
    });

    const catalogMap: Record<string, string> = {};
    targetStrings.forEach((item) => {
      catalogMap[item.key] = item.value;
    });

    // 2. If target locale is not 'en', fetch English fallback strings
    if (targetLocale !== 'en') {
      const enStrings = await prisma.i18nString.findMany({
        where: {
          locale: 'en',
          status: I18nStatus.PUBLISHED,
          ...whereNs,
        },
      });

      for (const enItem of enStrings) {
        if (!catalogMap[enItem.key]) {
          // Missing in target locale, fallback to English
          catalogMap[enItem.key] = enItem.value;
          // Log missing key gap asynchronously (FR-LOC-01)
          await this.logMissingKeyGap(enItem.key, enItem.namespace, targetLocale);
        }
      }
    }

    return {
      locale: targetLocale,
      namespace: namespace || 'all',
      version: version || 1,
      catalog: catalogMap,
    };
  }

  /**
   * PUT /api/v1/admin/i18n/strings/:key
   * Admin endpoint to create or update a catalog string value.
   * VR-LOC-01 & FR-LOC-03 validation & legal-review state machine.
   */
  async createOrUpdateString(key: string, dto: CreateUpdateStringDto, updatedBy: string = 'admin') {
    // 1. Key validation (VR-LOC-01)
    const keyValid = validateCatalogKey(key);
    if (!keyValid.isValid) {
      throw new BadRequestException(keyValid.error);
    }

    // 2. Value validation (VR-LOC-01)
    const valValid = validateCatalogValue(dto.value);
    if (!valValid.isValid) {
      throw new BadRequestException(valValid.error);
    }

    const locale = (dto.locale || 'en').toLowerCase();
    const namespace = dto.namespace || key.split('.')[0] || 'common';
    const isLegalSensitive = dto.legalSensitive ?? (namespace === 'legal');

    // 3. Determine status (FR-LOC-03: legal_sensitive edited -> LEGAL_REVIEW)
    const nextStatus = isLegalSensitive ? I18nStatus.LEGAL_REVIEW : I18nStatus.PUBLISHED;

    // Check existing string
    const existing = await prisma.i18nString.findFirst({
      where: { key, locale, version: 1 },
    });

    let record;
    if (existing) {
      record = await prisma.i18nString.update({
        where: { id: existing.id },
        data: {
          value: dto.value,
          namespace,
          legalSensitive: isLegalSensitive,
          status: nextStatus,
          updatedBy,
        },
      });
    } else {
      record = await prisma.i18nString.create({
        data: {
          key,
          namespace,
          locale,
          value: dto.value,
          legalSensitive: isLegalSensitive,
          status: nextStatus,
          updatedBy,
        },
      });
    }

    return {
      status: 'success',
      item: record,
      requiresLegalApproval: isLegalSensitive && nextStatus === I18nStatus.LEGAL_REVIEW,
    };
  }

  /**
   * POST /api/v1/admin/i18n/strings/:key/review
   * Admin / Legal Counsel review approval endpoint (FR-LOC-03).
   */
  async recordLegalReview(key: string, dto: RecordReviewDto) {
    const locale = (dto.locale || 'en').toLowerCase();

    const targetString = await prisma.i18nString.findFirst({
      where: { key, locale },
    });

    if (!targetString) {
      throw new NotFoundException(`Catalog string for key [${key}] and locale [${locale}] not found.`);
    }

    // Record review audit log
    const reviewRecord = await prisma.i18nReview.create({
      data: {
        stringKey: key,
        locale,
        reviewerId: dto.reviewerId,
        decision: dto.decision as unknown as I18nReviewDecision,
        note: dto.note || null,
      },
    });

    // Update string status if approved
    let updatedString = targetString;
    if (dto.decision === ReviewDecision.APPROVED) {
      updatedString = await prisma.i18nString.update({
        where: { id: targetString.id },
        data: {
          status: I18nStatus.PUBLISHED,
          updatedBy: dto.reviewerId,
        },
      });
    } else if (dto.decision === ReviewDecision.REJECTED) {
      updatedString = await prisma.i18nString.update({
        where: { id: targetString.id },
        data: {
          status: I18nStatus.DRAFT,
          updatedBy: dto.reviewerId,
        },
      });
    }

    return {
      status: 'success',
      review: reviewRecord,
      string: updatedString,
    };
  }

  /**
   * GET /api/v1/admin/i18n/coverage
   * Coverage metrics & missing key backlog dashboard (FR-LOC-05).
   */
  async getCoverageMetrics() {
    const allStrings = await prisma.i18nString.findMany();
    const missingKeys = await prisma.i18nMissingKeyLog.findMany({
      orderBy: { requestedCount: 'desc' },
      take: 50,
    });

    const namespaces = Array.from(new Set(allStrings.map((s) => s.namespace))) as string[];
    const coverageByNs: Record<string, { total: number; published: number; percentage: number }> = {};

    for (const ns of namespaces) {
      const nsStrings = allStrings.filter((s) => s.namespace === ns);
      const publishedCount = nsStrings.filter((s) => s.status === I18nStatus.PUBLISHED).length;
      const pct = nsStrings.length > 0 ? Number(((publishedCount / nsStrings.length) * 100).toFixed(1)) : 0;
      coverageByNs[ns] = {
        total: nsStrings.length,
        published: publishedCount,
        percentage: pct,
      };
    }

    const totalKeys = allStrings.length;
    const publishedTotal = allStrings.filter((s) => s.status === I18nStatus.PUBLISHED).length;
    const pendingLegalReview = allStrings.filter((s) => s.status === I18nStatus.LEGAL_REVIEW).length;

    return {
      overallCompletionPercentage: totalKeys > 0 ? Number(((publishedTotal / totalKeys) * 100).toFixed(1)) : 100,
      totalCatalogKeys: totalKeys,
      publishedKeys: publishedTotal,
      pendingLegalReviewCount: pendingLegalReview,
      coveragePercentageByNamespace: coverageByNs,
      missingKeysBacklog: missingKeys,
      cdnEdgeConfig: {
        cacheControlHeader: 'public, max-age=300, s-maxage=300',
        propagationTimeTargetMinutes: 5,
        status: 'HEALTHY',
      },
    };
  }

  /**
   * Asynchronously records or increments missing translation key gaps.
   */
  async logMissingKeyGap(key: string, namespace: string, locale: string) {
    try {
      await prisma.i18nMissingKeyLog.upsert({
        where: { key_locale: { key, locale } },
        update: {
          requestedCount: { increment: 1 },
          lastRequestedAt: new Date(),
        },
        create: {
          key,
          namespace,
          locale,
          requestedCount: 1,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to log missing key gap [${key}]: ${err.message}`);
    }
  }

  /**
   * User preference sync helper (FR-LOC-04).
   */
  async updateUserLocalePreference(userId: string, locale: string, timezone?: string) {
    if (!['en', 'am'].includes(locale)) {
      throw new BadRequestException(`Invalid locale: ${locale}. MVP supports 'en' and 'am'.`);
    }

    const pref = await prisma.userPreference.upsert({
      where: { userId },
      update: {
        locale,
        ...(timezone ? { timezone } : {}),
      },
      create: {
        userId,
        locale,
        timezone: timezone || 'Africa/Addis_Ababa',
      },
    });

    // Also update main User locale field
    await prisma.user.update({
      where: { id: userId },
      data: { locale },
    });

    return { status: 'success', userPreference: pref };
  }
}
