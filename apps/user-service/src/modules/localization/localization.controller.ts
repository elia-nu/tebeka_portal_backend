import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { LocalizationService } from './localization.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { CreateUpdateStringDto } from './dto/create-update-string.dto';
import { RecordReviewDto } from './dto/record-review.dto';

@Controller()
export class LocalizationController {
  constructor(private readonly localizationService: LocalizationService) {}

  @AllowAnonymous()
  @Get('localization/languages')
  async getLanguages() {
    return this.localizationService.getLanguages();
  }

  @Patch('localization/language')
  async updateDefaultLanguage(@Body() body: { code: string }) {
    return this.localizationService.updateDefaultLanguage(body);
  }

  /**
   * Section 6.7: GET /api/v1/i18n/catalog/:locale?ns=&v=
   * Public CDN-cached catalog endpoint (FR-LOC-01, BR-LOC-01).
   */
  @AllowAnonymous()
  @Get(['i18n/catalog/:locale', 'api/v1/i18n/catalog/:locale'])
  async getCatalog(
    @Param('locale') locale: string,
    @Query('ns') ns?: string,
    @Query('v') v?: string,
    @Res() res?: Response
  ) {
    const versionNum = v ? parseInt(v, 10) : 1;
    const result = await this.localizationService.getPublishedCatalog(locale, ns, versionNum);

    if (res) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
      return res.status(HttpStatus.OK).json(result);
    }
    return result;
  }

  /**
   * Section 6.7: PUT /api/v1/admin/i18n/strings/:key
   * Create or update a string value (VR-LOC-01, FR-LOC-03).
   */
  @Put(['admin/i18n/strings/:key', 'api/v1/admin/i18n/strings/:key'])
  async createOrUpdateString(
    @Param('key') key: string,
    @Body() dto: CreateUpdateStringDto
  ) {
    return this.localizationService.createOrUpdateString(key, dto);
  }

  /**
   * Section 6.7: POST /api/v1/admin/i18n/strings/:key/review
   * Record legal review approval (FR-LOC-03, OQ#10/OQ#11).
   */
  @Post(['admin/i18n/strings/:key/review', 'api/v1/admin/i18n/strings/:key/review'])
  async recordLegalReview(
    @Param('key') key: string,
    @Body() dto: RecordReviewDto
  ) {
    return this.localizationService.recordLegalReview(key, dto);
  }

  /**
   * Section 6.7: GET /api/v1/admin/i18n/coverage
   * Coverage metrics and missing keys backlog (FR-LOC-05).
   */
  @Get(['admin/i18n/coverage', 'api/v1/admin/i18n/coverage', 'localization/dashboard'])
  async getCoverage() {
    return this.localizationService.getCoverageMetrics();
  }

  /**
   * FR-LOC-04: User preference locale sync.
   */
  @Put(['users/me/preferences/locale', 'api/v1/users/me/preferences/locale', 'user/preferences/locale'])
  async updateUserLocalePreference(
    @Body() body: { userId: string; locale: string; timezone?: string }
  ) {
    return this.localizationService.updateUserLocalePreference(body.userId, body.locale, body.timezone);
  }
}
