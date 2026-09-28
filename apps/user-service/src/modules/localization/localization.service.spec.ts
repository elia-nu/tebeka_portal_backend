import { Test, TestingModule } from '@nestjs/testing';
import { LanguagePreferenceService } from './services/language-preference.service';
import { CatalogAdminService } from './services/catalog-admin.service';
import { CatalogPublishingService } from './services/catalog-publishing.service';
import { PrismaService } from '@workspace/database';
import { I18nStatus, I18nReviewDecision } from './localization-shared/enums';
import { ReviewDecision } from './dto/record-review.dto';

describe('User Service - Localization Module (FR-LOC-01 to FR-LOC-05)', () => {
  let langService: LanguagePreferenceService;
  let catalogAdminService: CatalogAdminService;
  let catalogPublishingService: CatalogPublishingService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'usr-1', email: 'test@example.com' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'usr-1', status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue({ id: 'usr-1', locale: 'am' }),
      },
      userPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'pref-1', userId: 'usr-1', locale: 'am', timezone: 'Africa/Addis_Ababa' }),
        update: jest.fn().mockResolvedValue({ id: 'pref-1', userId: 'usr-1', locale: 'am', timezone: 'Africa/Addis_Ababa' }),
      },
      i18nString: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      i18nReview: {
        create: jest.fn(),
      },
      i18nMissingKeyLog: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LanguagePreferenceService,
        CatalogAdminService,
        CatalogPublishingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    langService = module.get<LanguagePreferenceService>(LanguagePreferenceService);
    catalogAdminService = module.get<CatalogAdminService>(CatalogAdminService);
    catalogPublishingService = module.get<CatalogPublishingService>(CatalogPublishingService);
  });

  describe('LanguagePreferenceService (FR-LOC-04)', () => {
    it('should return supported languages list including English and Amharic', async () => {
      const result = await langService.getLanguages();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
      const codes = result.map((l: any) => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('am');
    });

    it('should update user locale preference and upsert user preferences', async () => {
      const res = await langService.updateUserLocalePreference('usr-1', 'am', 'Africa/Addis_Ababa');
      expect(res.status).toBe('success');
      expect(res.userPreference).toBeDefined();
      expect(res.userPreference.locale).toBe('am');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-1' },
        data: { locale: 'am' },
      });
      expect(mockPrisma.userPreference.create).toHaveBeenCalledWith({
        data: {
          userId: 'usr-1',
          locale: 'am',
          timezone: 'Africa/Addis_Ababa',
        },
      });
    });
  });

  describe('CatalogAdminService (FR-LOC-03, VR-LOC-01)', () => {
    it('should create or update an i18n string and track draft/review status', async () => {
      mockPrisma.i18nString.findFirst.mockResolvedValue(null);
      mockPrisma.i18nString.create.mockResolvedValue({
        id: 'str-1',
        key: 'legal.disclaimer',
        locale: 'am',
        value: 'የህግ ማስተባበያ',
        namespace: 'legal',
        legalSensitive: true,
        status: I18nStatus.LEGAL_REVIEW,
      });

      const res = await catalogAdminService.createOrUpdateString('legal.disclaimer', {
        locale: 'am',
        value: 'የህግ ማስተባበያ',
        namespace: 'legal',
        legalSensitive: true,
      });

      expect(res.status).toBe('success');
      expect(res.requiresLegalApproval).toBe(true);
      expect(res.item.status).toBe(I18nStatus.LEGAL_REVIEW);
      expect(mockPrisma.i18nString.create).toHaveBeenCalled();
    });

    it('should record legal review decision and log audit trail', async () => {
      mockPrisma.i18nString.findFirst.mockResolvedValue({
        id: 'str-1',
        key: 'legal.disclaimer',
        locale: 'am',
        status: I18nStatus.LEGAL_REVIEW,
      });

      mockPrisma.i18nReview.create.mockResolvedValue({
        id: 'rev-1',
        stringKey: 'legal.disclaimer',
        locale: 'am',
        reviewerId: 'admin-legal-counsel',
        decision: I18nReviewDecision.APPROVED,
      });

      mockPrisma.i18nString.update.mockResolvedValue({
        id: 'str-1',
        key: 'legal.disclaimer',
        locale: 'am',
        status: I18nStatus.PUBLISHED,
      });

      const res = await catalogAdminService.recordLegalReview('legal.disclaimer', {
        locale: 'am',
        decision: ReviewDecision.APPROVED,
        reviewerId: 'admin-legal-counsel',
        note: 'Complies with Ethiopian civil code terminology',
      });

      expect(res.status).toBe('success');
      expect(res.string.status).toBe(I18nStatus.PUBLISHED);
      expect(mockPrisma.i18nReview.create).toHaveBeenCalled();
      expect(mockPrisma.i18nString.update).toHaveBeenCalledWith({
        where: { id: 'str-1' },
        data: {
          status: I18nStatus.PUBLISHED,
          updatedBy: 'admin-legal-counsel',
        },
      });
    });
  });

  describe('CatalogPublishingService (FR-LOC-01, FR-LOC-05)', () => {
    it('should return published catalog dictionary for requested locale', async () => {
      mockPrisma.i18nString.findMany
        .mockResolvedValueOnce([
          { key: 'common.save', value: 'አስቀምጥ', namespace: 'common' },
        ])
        .mockResolvedValueOnce([
          { key: 'common.save', value: 'Save', namespace: 'common' },
          { key: 'common.cancel', value: 'Cancel', namespace: 'common' },
        ]);

      const catalog = await catalogPublishingService.getPublishedCatalog('am', 'common');
      expect(catalog.locale).toBe('am');
      expect(catalog.catalog['common.save']).toBe('አስቀምጥ');
      expect(catalog.catalog['common.cancel']).toBe('Cancel'); // fallback to English
    });

    it('should return coverage metrics and missing keys count (FR-LOC-05)', async () => {
      mockPrisma.i18nString.findMany.mockResolvedValue([
        { key: 'common.save', namespace: 'common', status: I18nStatus.PUBLISHED },
        { key: 'legal.terms', namespace: 'legal', status: I18nStatus.LEGAL_REVIEW },
      ]);
      mockPrisma.i18nMissingKeyLog.findMany.mockResolvedValue([
        { key: 'common.help', locale: 'am', requestedCount: 5 },
      ]);

      const coverage = await catalogPublishingService.getCoverageMetrics();
      expect(coverage.totalCatalogKeys).toBe(2);
      expect(coverage.publishedKeys).toBe(1);
      expect(coverage.pendingLegalReviewCount).toBe(1);
      expect(coverage.missingKeysBacklog).toHaveLength(1);
      expect(coverage.coveragePercentageByNamespace['common'].percentage).toBe(100);
      expect(coverage.coveragePercentageByNamespace['legal'].percentage).toBe(0);
    });
  });
});

