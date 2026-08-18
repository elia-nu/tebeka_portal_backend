import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../localization-shared/prisma';
import { I18nStatus } from '../localization-shared/enums';

@Injectable()
export class CatalogPublishingService {
  private readonly logger = new Logger(CatalogPublishingService.name);

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
}
