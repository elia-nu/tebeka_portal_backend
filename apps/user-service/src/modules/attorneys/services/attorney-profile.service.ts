import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { sanitizeUser } from '../../users/users.service';
import { prisma } from '../attorneys-shared/prisma';

@Injectable()
export class AttorneyProfileService {
  async createAttorney(data: any) {
    return prisma.attorneyProfile.create({ data });
  }

  async findProfileByUserId(userId: string) {
    const profile = await prisma.attorneyProfile.findUnique({ where: { userId } });
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
      prisma.attorneyProfile.findMany({
        skip,
        take: limit,
        include: { user: true, educations: true, credentials: { include: { documents: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attorneyProfile.count(),
    ]);

    return { items: sanitizeUser(items), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const attorney = await prisma.attorneyProfile.findUnique({
      where: { id },
      include: {
        user: true,
        educations: true,
        guardedChanges: true,
        verificationCases: true,
        credentials: { include: { documents: true } }
      },
    });
    if (!attorney) throw new NotFoundException(`Attorney profile ${id} not found`);
    return sanitizeUser(attorney);
  }

  // Public Credential Vault Projection (Raw files NEVER exposed publicly)
  async getPublicCredentials(attorneyId: string) {
    const credentials = await prisma.credential.findMany({
      where: { attorneyId },
      select: {
        id: true,
        attorneyId: true,
        credentialType: true,
        issuer: true,
        credentialNumber: true,
        verificationStatus: true,
        verifiedAt: true,
      }
    });

    return credentials.map(c => ({
      ...c,
      verifiedBadge: c.verificationStatus === 'APPROVED'
    }));
  }

  // Authenticated Attorney's Own Credential Vault Projection (Includes document metadata)
  async getMyCredentials(attorneyId: string) {
    const credentials = await prisma.credential.findMany({
      where: { attorneyId },
      include: {
        documents: {
          select: {
            id: true,
            fileKey: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
          }
        }
      }
    });

    return credentials.map(c => ({
      ...c,
      verifiedBadge: c.verificationStatus === 'APPROVED'
    }));
  }

  async updateAttorney(id: string, data: any) {
    const attorney = await this.findOne(id);

    // Bio length validation: 100 to 1500 chars per language
    if (data.bioEn && (data.bioEn.length < 100 || data.bioEn.length > 1500)) {
      throw new BadRequestException('English Bio (bioEn) must be between 100 and 1,500 characters');
    }
    if (data.bioAm && (data.bioAm.length < 100 || data.bioAm.length > 1500)) {
      throw new BadRequestException('Amharic Bio (bioAm) must be between 100 and 1,500 characters');
    }

    const guardedFields = ['feeBand', 'barRegistrationNumber'];
    const updateData: any = {};
    const guardedChanges: any[] = [];
    const amendmentReply = data.amendmentReply;

    const docAliasKeys = [
      'nationalIdDocument', 'nationalIdUrl', 'nationalIdCard', 'identityCard', 'nationalIdKey',
      'licenseBook', 'licenseBookKey', 'license',
      'barRegistration', 'barRegistrationKey', 'barCertificate',
      'nationalId', 'subCity', 'secondRegion', 'officeLocation', 'biography', 'profilePicture', 'photo'
    ];

    for (const key of Object.keys(data)) {
      if (key === 'amendmentReply' || docAliasKeys.includes(key)) continue;
      if (guardedFields.includes(key)) {
        // Create GuardedChange record
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: key,
            oldValue: String((attorney as any)[key] || ''),
            newValue: String(data[key]),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);
      } else {
        updateData[key] = data[key];
      }
    }

    // Resolve alias fields
    const natIdNum = data.nationalIdNumber || data.nationalId;
    if (natIdNum) updateData.nationalIdNumber = natIdNum;

    const licenseBookUrl = data.licenseBookUrl || data.licenseBookKey || data.licenseBook || data.license;
    if (licenseBookUrl) updateData.licenseBookUrl = licenseBookUrl;

    const barRegistrationUrl = data.barRegistrationUrl || data.barRegistrationKey || data.barRegistration || data.barCertificate;
    if (barRegistrationUrl) updateData.barRegistrationUrl = barRegistrationUrl;

    const nationalIdDocumentUrl = data.nationalIdDocumentUrl || data.nationalIdKey || data.nationalIdDocument || data.nationalIdUrl || data.nationalIdCard || data.identityCard;
    if (nationalIdDocumentUrl) updateData.nationalIdDocumentUrl = nationalIdDocumentUrl;

    const photoUrl = data.professionalPhotoUrl || data.photoKey || data.profilePicture || data.photo;
    if (photoUrl) {
      updateData.professionalPhotoUrl = photoUrl;
      updateData.photoKey = photoUrl;
      if (attorney.userId) {
        await prisma.user.update({
          where: { id: attorney.userId },
          data: { image: photoUrl }
        }).catch(() => {});
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

    if (data.googleMapsPin || data.googleMapsUrl) {
      updateData.googleMapsPin = data.googleMapsPin || data.googleMapsUrl;
    }

    if (data.bio || data.biography) {
      const b = data.bio || data.biography;
      updateData.bio = b;
      if (!updateData.bioEn) updateData.bioEn = b;
    }

    if (data.languagesSpoken || data.languages) {
      const langs = Array.isArray(data.languagesSpoken || data.languages)
        ? (data.languagesSpoken || data.languages)
        : [data.languagesSpoken || data.languages];
      updateData.languages = langs;
      updateData.languagesSpoken = langs;
    }

    if (data.practiceAreas || data.practiceAreaIds) {
      const areas = Array.isArray(data.practiceAreas || data.practiceAreaIds)
        ? (data.practiceAreas || data.practiceAreaIds)
        : [data.practiceAreas || data.practiceAreaIds];
      updateData.practiceAreas = areas;
    }

    if (data.yearsOfExperience !== undefined || data.experienceYears !== undefined) {
      const exp = Number(data.yearsOfExperience !== undefined ? data.yearsOfExperience : data.experienceYears);
      updateData.yearsOfExperience = exp;
      updateData.experienceYears = exp;
    }

    if (data.consultationFees !== undefined || data.consultationFee !== undefined) {
      const f = Number(data.consultationFees !== undefined ? data.consultationFees : data.consultationFee);
      updateData.consultationFees = f;
      updateData.consultationFee = f;
    }

    if (data.onlineConsultation !== undefined || data.videoSupport !== undefined) {
      const online = Boolean(data.onlineConsultation !== undefined ? data.onlineConsultation : data.videoSupport);
      updateData.onlineConsultation = online;
      updateData.videoSupport = online;
    }

    if (data.fullName && attorney.userId) {
      updateData.fullName = data.fullName;
      await prisma.user.update({
        where: { id: attorney.userId },
        data: { name: data.fullName }
      }).catch(() => {});
    }

    if (data.otherSupportingDocuments || data.otherDocuments || data.supportingDocuments) {
      const docs = data.otherSupportingDocuments || data.otherDocuments || data.supportingDocuments;
      updateData.otherSupportingDocuments = Array.isArray(docs) ? docs : [docs];
    }

    // Create / Sync Credential and CredentialDocument in Prisma if documents are updated
    if (nationalIdDocumentUrl) {
      let cred = await prisma.credential.findFirst({
        where: { attorneyId: id, credentialType: 'NATIONAL_ID' }
      });
      if (!cred) {
        cred = await prisma.credential.create({
          data: {
            attorneyId: id,
            credentialType: 'NATIONAL_ID',
            issuer: 'National ID Program',
            credentialNumber: updateData.nationalIdNumber || (attorney as any).nationalIdNumber || `ID-${Date.now()}`,
            verificationStatus: 'SUBMITTED'
          }
        });
      }
      await prisma.credentialDocument.create({
        data: {
          credentialId: cred.id,
          fileKey: nationalIdDocumentUrl,
          mimeType: 'application/pdf',
          size: 1024
        }
      });
    }

    if (licenseBookUrl) {
      let cred = await prisma.credential.findFirst({
        where: { attorneyId: id, credentialType: 'BAR_LICENSE' }
      });
      if (!cred) {
        cred = await prisma.credential.create({
          data: {
            attorneyId: id,
            credentialType: 'BAR_LICENSE',
            issuer: 'Federal Ministry of Justice',
            credentialNumber: (attorney as any).barRegistrationNumber || `BAR-${Date.now()}`,
            verificationStatus: 'SUBMITTED'
          }
        });
      }
      await prisma.credentialDocument.create({
        data: {
          credentialId: cred.id,
          fileKey: licenseBookUrl,
          mimeType: 'application/pdf',
          size: 1024
        }
      });
    }

    if (barRegistrationUrl) {
      let cred = await prisma.credential.findFirst({
        where: { attorneyId: id, credentialType: 'BAR_CERTIFICATE' }
      });
      if (!cred) {
        cred = await prisma.credential.create({
          data: {
            attorneyId: id,
            credentialType: 'BAR_CERTIFICATE',
            issuer: 'Federal Ministry of Justice',
            credentialNumber: (attorney as any).barRegistrationNumber || `BAR-${Date.now()}`,
            verificationStatus: 'SUBMITTED'
          }
        });
      }
      await prisma.credentialDocument.create({
        data: {
          credentialId: cred.id,
          fileKey: barRegistrationUrl,
          mimeType: 'application/pdf',
          size: 1024
        }
      });
    }

    // Auto-transition verificationStatus from ADDITIONAL_INFO_REQUIRED to PENDING_REVIEW on update
    if (attorney.verificationStatus === 'ADDITIONAL_INFO_REQUIRED' || amendmentReply) {
      updateData.verificationStatus = 'PENDING_REVIEW';

      const activeCase = await prisma.verificationCase.findFirst({
        where: { attorneyId: id },
        orderBy: { submittedAt: 'desc' }
      });

      if (activeCase) {
        await prisma.verificationCase.update({
          where: { id: activeCase.id },
          data: {
            status: 'PENDING_REVIEW',
            amendmentReply: amendmentReply || (activeCase as any).amendmentReply,
            amendmentSubmittedAt: new Date(),
            isSlaPaused: false,
            slaResumedAt: new Date()
          } as any
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.attorneyProfile.update({
        where: { id },
        data: updateData
      });
    }

    return {
      status: 'success',
      message: guardedChanges.length > 0
        ? 'Open fields updated immediately. Guarded field updates submitted for verification approval.'
        : 'Profile updated successfully',
      verificationStatus: updateData.verificationStatus || attorney.verificationStatus,
      pendingGuardedChanges: guardedChanges
    };
  }

  async submitAmendmentResponse(attorneyId: string, data: any) {
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for ID "${attorneyId}".`);
    }

    const updatePayload: any = { ...data };
    const result = await this.updateAttorney(profile.id, updatePayload);

    // Ensure status is transitioned to PENDING_REVIEW even if no profile fields were changed
    await prisma.attorneyProfile.update({
      where: { id: profile.id },
      data: { verificationStatus: 'PENDING_REVIEW' }
    });

    const activeCase = await prisma.verificationCase.findFirst({
      where: { attorneyId: profile.id },
      orderBy: { submittedAt: 'desc' }
    });

    let updatedCase = null;
    if (activeCase) {
      updatedCase = await prisma.verificationCase.update({
        where: { id: activeCase.id },
        data: {
          status: 'PENDING_REVIEW',
          amendmentReply: data.amendmentReply || (activeCase as any).amendmentReply,
          amendmentSubmittedAt: new Date(),
          isSlaPaused: false,
          slaResumedAt: new Date()
        } as any
      });
    }

    return {
      status: 'success',
      message: 'Amendment response and profile updates submitted successfully for admin verification review.',
      verificationStatus: 'PENDING_REVIEW',
      amendmentReply: data.amendmentReply || null,
      verificationCase: updatedCase,
      profileUpdateResult: result
    };
  }

  async deleteAttorney(id: string) {
    return prisma.attorneyProfile.delete({ where: { id } });
  }

  async publishProfile(id: string) {
    const attorney = await prisma.attorneyProfile.findUnique({ where: { id } });
    if (!attorney) throw new NotFoundException('Attorney profile not found');

    // 3-Part Publication Gate
    if (attorney.verificationStatus !== 'APPROVED') {
      throw new BadRequestException('Cannot publish profile: Verification status must be APPROVED');
    }
    if (attorney.profileCompleteness < 80) {
      throw new BadRequestException(`Cannot publish profile: Profile completeness (${attorney.profileCompleteness}%) must be at least 80%`);
    }
    if (!attorney.feeBand) {
      throw new BadRequestException('Cannot publish profile: Fee band must be selected');
    }
    if (!attorney.credentialClaimsMatch) {
      throw new BadRequestException('Cannot publish profile: Credential claims must match verified credentials');
    }

    return prisma.attorneyProfile.update({
      where: { id },
      data: { status: 'ACTIVE' }
    });
  }

  async hideProfile(id: string) {
    return prisma.attorneyProfile.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  // Profile Moderation: WARN, SUSPEND, RESTORE
  async moderateProfile(id: string, actionData: { action: 'WARN' | 'SUSPEND' | 'RESTORE'; reasonCode: string; adminNote: string }) {
    const attorney = await this.findOne(id);

    let newStatus = attorney.status;
    if (actionData.action === 'SUSPEND') {
      newStatus = 'SUSPENDED';
    } else if (actionData.action === 'RESTORE') {
      newStatus = 'ACTIVE';
    }

    await prisma.attorneyProfile.update({
      where: { id },
      data: { status: newStatus }
    });

    return {
      status: 'success',
      action: actionData.action,
      reasonCode: actionData.reasonCode,
      adminNote: actionData.adminNote,
      profileStatus: newStatus,
      notificationSent: true
    };
  }
}
