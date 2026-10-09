import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { sanitizeUser } from '../../users/users.service';
import { PrismaService } from '@workspace/database';
import { AttorneyVaultService } from './attorney-vault.service';
import { AttorneyModerationService } from './attorney-moderation.service';
import { evaluateAndRecordGuardedChanges } from '../utils/attorney-guarded-fields.util';
import { calculateAttorneyProfileCompleteness } from '../utils/attorney-completeness.util';

@Injectable()
export class AttorneyProfileService {
  private readonly moderationService: AttorneyModerationService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly vaultService?: AttorneyVaultService,
    @Optional() attorneyModerationService?: AttorneyModerationService
  ) {
    this.moderationService = attorneyModerationService || new AttorneyModerationService(this.prisma);
  }

  async createAttorney(data: any) {
    return this.prisma.attorneyProfile.create({ data });
  }

  async findProfileByUserId(userId: string) {
    const profile = await this.prisma.attorneyProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(`No attorney profile found for authenticated user.`);
    }
    return profile;
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.attorneyProfile.findMany({
        skip,
        take: limit,
        include: { user: true, educations: true, credentials: { include: { documents: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.attorneyProfile.count(),
    ]);

    return {
      items: sanitizeUser(items),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    let attorney = await this.prisma.attorneyProfile.findUnique({
      where: { id },
      include: {
        user: true,
        educations: true,
        guardedChanges: true,
        verificationCases: true,
        credentials: { include: { documents: true } },
      },
    });

    if (!attorney) {
      attorney = await this.prisma.attorneyProfile.findUnique({
        where: { userId: id },
        include: {
          user: true,
          educations: true,
          guardedChanges: true,
          verificationCases: true,
          credentials: { include: { documents: true } },
        },
      });
    }

    if (!attorney) throw new NotFoundException(`Attorney profile ${id} not found`);
    return sanitizeUser(attorney);
  }

  // Public Credential Vault Projection (Delegated to AttorneyVaultService)
  async getPublicCredentials(attorneyId: string) {
    if (this.vaultService) {
      return this.vaultService.getPublicCredentials(attorneyId);
    }
    const credentials = await this.prisma.credential.findMany({
      where: { attorneyId },
      select: {
        id: true,
        attorneyId: true,
        credentialType: true,
        issuer: true,
        credentialNumber: true,
        verificationStatus: true,
        verifiedAt: true,
      },
    });

    return credentials.map((c) => ({
      ...c,
      verifiedBadge: c.verificationStatus === 'APPROVED',
    }));
  }

  // Authenticated Attorney's Own Credential Vault Projection (Delegated to AttorneyVaultService)
  async getMyCredentials(attorneyId: string) {
    if (this.vaultService) {
      return this.vaultService.getMyCredentials(attorneyId);
    }
    const credentials = await this.prisma.credential.findMany({
      where: { attorneyId },
      include: {
        documents: {
          select: {
            id: true,
            fileKey: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
          },
        },
      },
    });

    return credentials.map((c) => ({
      ...c,
      verifiedBadge: c.verificationStatus === 'APPROVED',
    }));
  }

  async updateAttorney(id: string, data: any) {
    const attorney = await this.findOne(id);

    // Bio length validation: 100 to 1500 chars per language
    if (data.bioEn && (data.bioEn.length < 100 || data.bioEn.length > 1500)) {
      throw new BadRequestException(
        'English Bio (bioEn) must be between 100 and 1,500 characters'
      );
    }
    if (data.bioAm && (data.bioAm.length < 100 || data.bioAm.length > 1500)) {
      throw new BadRequestException(
        'Amharic Bio (bioAm) must be between 100 and 1,500 characters'
      );
    }

    const updateData: any = {};
    const amendmentReply = data.amendmentReply;

    // 1. Guarded fields evaluation (BR-PROF-01 / FR-PROF-02)
    const guardedChanges = await evaluateAndRecordGuardedChanges(
      this.prisma,
      id,
      attorney,
      data
    );

    // 2. Open fields persistence (Publish Immediately)
    const photoUrl =
      data.professionalPhotoUrl || data.photoKey || data.profilePicture || data.photo;
    if (photoUrl) {
      updateData.professionalPhotoUrl = photoUrl;
      updateData.photoKey = photoUrl;
      if (attorney.userId) {
        await this.prisma.user
          .update({
            where: { id: attorney.userId },
            data: { image: photoUrl },
          })
          .catch(() => {});
      }
    }

    if (data.officeAddress || data.officeLocation) {
      const addr = data.officeAddress || data.officeLocation;
      updateData.officeAddress = addr;
      updateData.officeLocation = addr;
    }

    if (data.secondLicenseRegion || data.secondRegion) {
      updateData.secondLicenseRegion = data.secondLicenseRegion || data.secondRegion;
    }

    if (data.subcity || data.subCity) {
      updateData.subcity = data.subcity || data.subCity;
    }

    if (data.city) updateData.city = data.city;
    if (data.region) updateData.region = data.region;
    if (data.country) updateData.country = data.country;

    if (data.googleMapsPin || data.googleMapsUrl) {
      updateData.googleMapsPin = data.googleMapsPin || data.googleMapsUrl;
    }
    if (data.latitude !== undefined) updateData.latitude = Number(data.latitude);
    if (data.longitude !== undefined) updateData.longitude = Number(data.longitude);
    if (data.lawFirmName !== undefined) updateData.lawFirmName = data.lawFirmName;

    if (data.bio || data.biography) {
      const b = data.bio || data.biography;
      updateData.bio = b;
      if (!updateData.bioEn && !data.bioEn) updateData.bioEn = b;
    }
    if (data.bioEn) updateData.bioEn = data.bioEn;
    if (data.bioAm) updateData.bioAm = data.bioAm;

    if (data.languagesSpoken || data.languages) {
      const langs = Array.isArray(data.languagesSpoken || data.languages)
        ? data.languagesSpoken || data.languages
        : [data.languagesSpoken || data.languages];
      updateData.languages = langs;
      updateData.languagesSpoken = langs;
    }

    if (data.yearsOfExperience !== undefined || data.experienceYears !== undefined) {
      const exp = Number(
        data.yearsOfExperience !== undefined ? data.yearsOfExperience : data.experienceYears
      );
      updateData.yearsOfExperience = exp;
      updateData.experienceYears = exp;
    }

    if (data.consultationFees !== undefined || data.consultationFee !== undefined) {
      const f = Number(
        data.consultationFees !== undefined ? data.consultationFees : data.consultationFee
      );
      updateData.consultationFees = f;
      updateData.consultationFee = f;
    }

    if (data.onlineConsultation !== undefined || data.videoSupport !== undefined) {
      const online = Boolean(
        data.onlineConsultation !== undefined
          ? data.onlineConsultation
          : data.videoSupport
      );
      updateData.onlineConsultation = online;
      updateData.videoSupport = online;
    }

    if (data.bufferTimeMinutes !== undefined)
      updateData.bufferTimeMinutes = Number(data.bufferTimeMinutes);
    if (data.maxBookingsPerDay !== undefined)
      updateData.maxBookingsPerDay = Number(data.maxBookingsPerDay);
    if (data.officeContactDetails !== undefined)
      updateData.officeContactDetails = data.officeContactDetails;
    if (data.availabilitySchedule !== undefined)
      updateData.availabilitySchedule = data.availabilitySchedule;

    if (data.fullName && attorney.userId) {
      updateData.fullName = data.fullName;
      await this.prisma.user
        .update({
          where: { id: attorney.userId },
          data: { name: data.fullName },
        })
        .catch(() => {});
    }

    // Auto-transition verificationStatus from ADDITIONAL_INFO_REQUIRED to PENDING_REVIEW on amendment reply
    if (attorney.verificationStatus === 'ADDITIONAL_INFO_REQUIRED' || amendmentReply) {
      updateData.verificationStatus = 'PENDING_REVIEW';

      const activeCase = await this.prisma.verificationCase.findFirst({
        where: { attorneyId: id },
        orderBy: { submittedAt: 'desc' },
      });

      if (activeCase) {
        await this.prisma.verificationCase.update({
          where: { id: activeCase.id },
          data: {
            status: 'PENDING_REVIEW',
            amendmentReply: amendmentReply || (activeCase as any).amendmentReply,
            amendmentSubmittedAt: new Date(),
            isSlaPaused: false,
            slaResumedAt: new Date(),
          } as any,
        });
      }
    }

    // 3. Re-verification routing (caseType: GUARDED_CHANGE)
    let guardedCase = null;
    if (guardedChanges.length > 0) {
      const slaDueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const checklistsToCreate = [
        { itemName: 'guarded_field_accuracy', status: 'PENDING' },
        { itemName: 'document_proof_verified', status: 'PENDING' },
      ];

      const changedFieldNames = guardedChanges.map((gc) => gc.field);
      if (
        changedFieldNames.includes('barRegistrationNumber') ||
        changedFieldNames.includes('licenseNumber')
      ) {
        checklistsToCreate.push({ itemName: 'bar_number_verification', status: 'PENDING' });
      }
      if (changedFieldNames.includes('practiceAreas')) {
        checklistsToCreate.push({
          itemName: 'practice_area_qualification',
          status: 'PENDING',
        });
      }
      if (
        changedFieldNames.includes('licenseBookUrl') ||
        changedFieldNames.includes('barRegistrationUrl') ||
        changedFieldNames.includes('nationalIdDocumentUrl') ||
        changedFieldNames.includes('nationalIdNumber') ||
        changedFieldNames.includes('otherSupportingDocuments')
      ) {
        checklistsToCreate.push({
          itemName: 'credential_document_verified',
          status: 'PENDING',
        });
      }
      if (changedFieldNames.includes('feeBand')) {
        checklistsToCreate.push({ itemName: 'fee_band_tier_compliance', status: 'PENDING' });
      }

      guardedCase = await this.prisma.verificationCase.create({
        data: {
          attorneyId: id,
          caseType: 'GUARDED_CHANGE',
          status: 'SUBMITTED',
          slaDueDate,
          checklists: {
            create: checklistsToCreate as any,
          },
        },
      });

      for (const gc of guardedChanges) {
        await this.prisma.guardedChange
          .update({
            where: { id: gc.id },
            data: { verificationCaseId: guardedCase.id },
          })
          .catch(() => {});
        gc.verificationCaseId = guardedCase.id;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.attorneyProfile.update({
        where: { id },
        data: updateData,
      });
    }

    return {
      status: 'success',
      message:
        guardedChanges.length > 0
          ? 'Open fields updated immediately. Guarded field updates submitted for verification approval.'
          : 'Profile updated successfully',
      verificationStatus: updateData.verificationStatus || attorney.verificationStatus,
      verificationCaseId: guardedCase?.id || null,
      hasPendingGuardedChanges: guardedChanges.length > 0,
      pendingGuardedChanges: guardedChanges,
    };
  }

  async submitAmendmentResponse(attorneyId: string, data: any) {
    let profile = await this.prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      profile = await this.prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for ID "${attorneyId}".`);
    }

    const updatePayload: any = { ...data };
    const result = await this.updateAttorney(profile.id, updatePayload);

    await this.prisma.attorneyProfile.update({
      where: { id: profile.id },
      data: { verificationStatus: 'PENDING_REVIEW' },
    });

    const activeCase = await this.prisma.verificationCase.findFirst({
      where: { attorneyId: profile.id },
      orderBy: { submittedAt: 'desc' },
    });

    let updatedCase = null;
    if (activeCase) {
      updatedCase = await this.prisma.verificationCase.update({
        where: { id: activeCase.id },
        data: {
          status: 'PENDING_REVIEW',
          amendmentReply: data.amendmentReply || (activeCase as any).amendmentReply,
          amendmentSubmittedAt: new Date(),
          isSlaPaused: false,
          slaResumedAt: new Date(),
        } as any,
      });
    }

    return {
      status: 'success',
      message:
        'Amendment response and profile updates submitted successfully for admin verification review.',
      verificationStatus: 'PENDING_REVIEW',
      amendmentReply: data.amendmentReply || null,
      verificationCase: updatedCase,
      profileUpdateResult: result,
    };
  }

  async deleteAttorney(id: string) {
    return this.prisma.attorneyProfile.delete({ where: { id } });
  }

  async publishProfile(id: string) {
    return this.moderationService.publishProfile(id);
  }

  async hideProfile(id: string) {
    return this.moderationService.hideProfile(id);
  }

  async moderateProfile(
    id: string,
    actionData: { action: 'WARN' | 'SUSPEND' | 'RESTORE'; reasonCode: string; adminNote: string }
  ) {
    return this.moderationService.moderateProfile(id, actionData);
  }
}

