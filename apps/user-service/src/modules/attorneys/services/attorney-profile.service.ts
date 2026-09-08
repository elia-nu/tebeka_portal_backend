import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { sanitizeUser } from '../../users/users.service';
import { prisma } from '../attorneys-shared/prisma';

import { AttorneyVaultService } from './attorney-vault.service';

@Injectable()
export class AttorneyProfileService {
  constructor(private readonly vaultService?: AttorneyVaultService) {}

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

  // Public Credential Vault Projection (Delegated to AttorneyVaultService)
  async getPublicCredentials(attorneyId: string) {
    if (this.vaultService) {
      return this.vaultService.getPublicCredentials(attorneyId);
    }
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

  // Authenticated Attorney's Own Credential Vault Projection (Delegated to AttorneyVaultService)
  async getMyCredentials(attorneyId: string) {
    if (this.vaultService) {
      return this.vaultService.getMyCredentials(attorneyId);
    }
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

    const updateData: any = {};
    const guardedChanges: any[] = [];
    const amendmentReply = data.amendmentReply;

    // ─────────────────────────────────────────────────────────────
    // 1. GUARDED FIELDS EVALUATION (BR-PROF-01 / FR-PROF-02)
    // Guarded fields: bar registration number, practice areas, credentials, fee band
    // Changes to these fields keep prior public values and route to verification queue.
    // ─────────────────────────────────────────────────────────────

    // a. Bar Number (barRegistrationNumber / licenseNumber / barNumber / aliases)
    const newBarNumber = data.barRegistrationNumber !== undefined ? data.barRegistrationNumber
      : (data.licenseNumber !== undefined ? data.licenseNumber
      : (data.barNumber !== undefined ? data.barNumber
      : (data.bar_registration_number !== undefined ? data.bar_registration_number : data.license_number)));

    if (newBarNumber !== undefined && newBarNumber !== null && String(newBarNumber).trim() !== '') {
      const oldBarNumber = attorney.barRegistrationNumber || attorney.licenseNumber || '';
      if (String(newBarNumber) !== String(oldBarNumber)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'barRegistrationNumber',
            oldValue: String(oldBarNumber),
            newValue: String(newBarNumber),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);
      }
    }

    // b. Practice Areas (practiceAreas / practiceAreaIds / practice_areas)
    const rawPracticeAreas = data.practiceAreas !== undefined ? data.practiceAreas
      : (data.practiceAreaIds !== undefined ? data.practiceAreaIds : data.practice_areas);

    if (rawPracticeAreas !== undefined && rawPracticeAreas !== null) {
      const parsedNewAreas: string[] = Array.isArray(rawPracticeAreas)
        ? rawPracticeAreas.map((a: any) => String(a).trim())
        : [String(rawPracticeAreas).trim()];
      const oldAreas: string[] = attorney.practiceAreas || [];
      if (JSON.stringify(parsedNewAreas) !== JSON.stringify(oldAreas)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'practiceAreas',
            oldValue: JSON.stringify(oldAreas),
            newValue: JSON.stringify(parsedNewAreas),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);
      }
    }

    // c. Fee Band (feeBand / fee_band / consultationFeeBand)
    const newFeeBand = data.feeBand !== undefined ? data.feeBand
      : (data.fee_band !== undefined ? data.fee_band : data.consultationFeeBand);

    if (newFeeBand !== undefined && newFeeBand !== null && String(newFeeBand).trim() !== '') {
      const oldFeeBand = attorney.feeBand || '';
      if (String(newFeeBand) !== String(oldFeeBand)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'feeBand',
            oldValue: String(oldFeeBand),
            newValue: String(newFeeBand),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);
      }
    }

    // d. Credentials & Verification Documents (nationalId, licenseBook, barRegistration, supporting documents)
    const natIdNum = data.nationalIdNumber || data.nationalId || data.national_id_number;
    if (natIdNum !== undefined && natIdNum !== null && String(natIdNum).trim() !== '') {
      const oldNatId = attorney.nationalIdNumber || '';
      if (String(natIdNum) !== String(oldNatId)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'nationalIdNumber',
            oldValue: String(oldNatId),
            newValue: String(natIdNum),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);
      }
    }

    const licenseBookUrl = data.licenseBookUrl || data.licenseBookKey || data.licenseBook || data.license || data.license_book_url;
    if (licenseBookUrl !== undefined && licenseBookUrl !== null && String(licenseBookUrl).trim() !== '') {
      const oldLicenseBook = attorney.licenseBookUrl || '';
      if (String(licenseBookUrl) !== String(oldLicenseBook)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'licenseBookUrl',
            oldValue: String(oldLicenseBook),
            newValue: String(licenseBookUrl),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);

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
    }

    const barRegistrationUrl = data.barRegistrationUrl || data.barRegistrationKey || data.barRegistration || data.barCertificate || data.bar_registration_url;
    if (barRegistrationUrl !== undefined && barRegistrationUrl !== null && String(barRegistrationUrl).trim() !== '') {
      const oldBarReg = attorney.barRegistrationUrl || '';
      if (String(barRegistrationUrl) !== String(oldBarReg)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'barRegistrationUrl',
            oldValue: String(oldBarReg),
            newValue: String(barRegistrationUrl),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);

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
    }

    const nationalIdDocumentUrl = data.nationalIdDocumentUrl || data.nationalIdKey || data.nationalIdDocument || data.nationalIdUrl || data.nationalIdCard || data.identityCard || data.national_id_document_url;
    if (nationalIdDocumentUrl !== undefined && nationalIdDocumentUrl !== null && String(nationalIdDocumentUrl).trim() !== '') {
      const oldNatDoc = attorney.nationalIdDocumentUrl || '';
      if (String(nationalIdDocumentUrl) !== String(oldNatDoc)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'nationalIdDocumentUrl',
            oldValue: String(oldNatDoc),
            newValue: String(nationalIdDocumentUrl),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);

        let cred = await prisma.credential.findFirst({
          where: { attorneyId: id, credentialType: 'NATIONAL_ID' }
        });
        if (!cred) {
          cred = await prisma.credential.create({
            data: {
              attorneyId: id,
              credentialType: 'NATIONAL_ID',
              issuer: 'National ID Program',
              credentialNumber: natIdNum || (attorney as any).nationalIdNumber || `ID-${Date.now()}`,
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
    }

    const otherDocs = data.otherSupportingDocuments || data.otherDocuments || data.supportingDocuments || data.other_supporting_documents;
    if (otherDocs !== undefined && otherDocs !== null) {
      const parsedDocs = Array.isArray(otherDocs) ? otherDocs : [otherDocs];
      const oldDocs = attorney.otherSupportingDocuments || [];
      if (JSON.stringify(parsedDocs) !== JSON.stringify(oldDocs)) {
        const gc = await prisma.guardedChange.create({
          data: {
            attorneyId: id,
            field: 'otherSupportingDocuments',
            oldValue: JSON.stringify(oldDocs),
            newValue: JSON.stringify(parsedDocs),
            status: 'PENDING'
          }
        });
        guardedChanges.push(gc);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. OPEN FIELDS PERSISTENCE (Publish Immediately)
    // ─────────────────────────────────────────────────────────────
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
        ? (data.languagesSpoken || data.languages)
        : [data.languagesSpoken || data.languages];
      updateData.languages = langs;
      updateData.languagesSpoken = langs;
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

    if (data.bufferTimeMinutes !== undefined) updateData.bufferTimeMinutes = Number(data.bufferTimeMinutes);
    if (data.maxBookingsPerDay !== undefined) updateData.maxBookingsPerDay = Number(data.maxBookingsPerDay);
    if (data.officeContactDetails !== undefined) updateData.officeContactDetails = data.officeContactDetails;
    if (data.availabilitySchedule !== undefined) updateData.availabilitySchedule = data.availabilitySchedule;

    if (data.fullName && attorney.userId) {
      updateData.fullName = data.fullName;
      await prisma.user.update({
        where: { id: attorney.userId },
        data: { name: data.fullName }
      }).catch(() => {});
    }

    // Auto-transition verificationStatus from ADDITIONAL_INFO_REQUIRED to PENDING_REVIEW on amendment reply
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

    // ─────────────────────────────────────────────────────────────
    // 3. RE-VERIFICATION ROUTING (caseType: GUARDED_CHANGE)
    // ─────────────────────────────────────────────────────────────
    let guardedCase = null;
    if (guardedChanges.length > 0) {
      const slaDueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const checklistsToCreate = [
        { itemName: 'guarded_field_accuracy', status: 'PENDING' },
        { itemName: 'document_proof_verified', status: 'PENDING' }
      ];

      const changedFieldNames = guardedChanges.map(gc => gc.field);
      if (changedFieldNames.includes('barRegistrationNumber') || changedFieldNames.includes('licenseNumber')) {
        checklistsToCreate.push({ itemName: 'bar_number_verification', status: 'PENDING' });
      }
      if (changedFieldNames.includes('practiceAreas')) {
        checklistsToCreate.push({ itemName: 'practice_area_qualification', status: 'PENDING' });
      }
      if (
        changedFieldNames.includes('licenseBookUrl') ||
        changedFieldNames.includes('barRegistrationUrl') ||
        changedFieldNames.includes('nationalIdDocumentUrl') ||
        changedFieldNames.includes('nationalIdNumber') ||
        changedFieldNames.includes('otherSupportingDocuments')
      ) {
        checklistsToCreate.push({ itemName: 'credential_document_verified', status: 'PENDING' });
      }
      if (changedFieldNames.includes('feeBand')) {
        checklistsToCreate.push({ itemName: 'fee_band_tier_compliance', status: 'PENDING' });
      }

      guardedCase = await prisma.verificationCase.create({
        data: {
          attorneyId: id,
          caseType: 'GUARDED_CHANGE',
          status: 'SUBMITTED',
          slaDueDate,
          checklists: {
            create: checklistsToCreate as any
          }
        }
      });

      for (const gc of guardedChanges) {
        await prisma.guardedChange.update({
          where: { id: gc.id },
          data: { verificationCaseId: guardedCase.id }
        }).catch(() => {});
        gc.verificationCaseId = guardedCase.id;
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
      verificationCaseId: guardedCase?.id || null,
      hasPendingGuardedChanges: guardedChanges.length > 0,
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
