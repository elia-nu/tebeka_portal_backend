import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { validateCatalogKey, validateCatalogValue } from '@workspace/localization';
import { prisma } from '../localization-shared/prisma';
import { I18nStatus, I18nReviewDecision } from '../localization-shared/enums';
import { CreateUpdateStringDto } from '../dto/create-update-string.dto';
import { RecordReviewDto, ReviewDecision } from '../dto/record-review.dto';

@Injectable()
export class CatalogAdminService {
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
}
