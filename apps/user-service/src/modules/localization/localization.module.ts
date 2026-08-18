import { Module } from '@nestjs/common';
import { LocalizationController } from './localization.controller';
import { LanguagePreferenceService } from './services/language-preference.service';
import { CatalogAdminService } from './services/catalog-admin.service';
import { CatalogPublishingService } from './services/catalog-publishing.service';

@Module({
  controllers: [LocalizationController],
  providers: [LanguagePreferenceService, CatalogAdminService, CatalogPublishingService],
  exports: [LanguagePreferenceService, CatalogAdminService, CatalogPublishingService],
})
export class LocalizationModule {}
