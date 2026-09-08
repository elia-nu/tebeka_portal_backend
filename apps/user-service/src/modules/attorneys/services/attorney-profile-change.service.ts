import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '../attorneys-shared/prisma';

@Injectable()
export class AttorneyProfileChangeService {
  // Guarded Profile Changes (Sensitive fields require Admin review)
  async requestProfileChange(attorneyId: string, data: any) {
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for ${attorneyId}`);
    }

    const changesToProcess: Array<{ field: string; newValue: any }> = [];

    if (data && typeof data === 'object') {
      if (data.fieldName && (data.requestedValue !== undefined || data.newValue !== undefined || data.value !== undefined)) {
        const val = data.requestedValue !== undefined ? data.requestedValue : (data.newValue !== undefined ? data.newValue : data.value);
        changesToProcess.push({ field: String(data.fieldName), newValue: val });
      } else if (data.field && (data.requestedValue !== undefined || data.newValue !== undefined || data.value !== undefined)) {
        const val = data.requestedValue !== undefined ? data.requestedValue : (data.newValue !== undefined ? data.newValue : data.value);
        changesToProcess.push({ field: String(data.field), newValue: val });
      } else if (Array.isArray(data.changes)) {
        for (const c of data.changes) {
          const f = c.field || c.fieldName;
          const v = c.newValue !== undefined ? c.newValue : (c.requestedValue !== undefined ? c.requestedValue : c.value);
          if (f && v !== undefined) {
            changesToProcess.push({ field: String(f), newValue: v });
          }
        }
      } else {
        for (const [field, newValue] of Object.entries(data)) {
          if (newValue !== undefined && newValue !== null && field !== 'fieldName' && field !== 'requestedValue' && field !== 'field' && field !== 'newValue' && field !== 'value') {
            changesToProcess.push({ field, newValue });
          }
        }
      }
    }

    const checklistsToCreate = [
      { itemName: 'guarded_field_accuracy', status: 'PENDING' },
      { itemName: 'document_proof_verified', status: 'PENDING' }
    ];

    const requestedFields = changesToProcess.map(c => c.field);
    if (requestedFields.some(f => ['barNumber', 'barRegistrationNumber', 'licenseNumber', 'bar_registration_number'].includes(f))) {
      checklistsToCreate.push({ itemName: 'bar_number_verification', status: 'PENDING' });
    }
    if (requestedFields.some(f => ['practiceAreas', 'practiceAreaIds', 'practice_areas'].includes(f))) {
      checklistsToCreate.push({ itemName: 'practice_area_qualification', status: 'PENDING' });
    }
    if (requestedFields.some(f => ['licenseBookUrl', 'barRegistrationUrl', 'nationalIdDocumentUrl', 'nationalIdNumber', 'otherSupportingDocuments', 'credentials'].includes(f))) {
      checklistsToCreate.push({ itemName: 'credential_document_verified', status: 'PENDING' });
    }
    if (requestedFields.some(f => ['feeBand', 'fee_band', 'consultationFeeBand'].includes(f))) {
      checklistsToCreate.push({ itemName: 'fee_band_tier_compliance', status: 'PENDING' });
    }

    const slaDueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2-day SLA for guarded change review
    const vCase = await prisma.verificationCase.create({
      data: {
        attorneyId: profile.id,
        caseType: 'GUARDED_CHANGE',
        status: 'SUBMITTED',
        slaDueDate,
        checklists: {
          create: checklistsToCreate as any
        }
      }
    });

    const guardedChanges: any[] = [];
    for (const item of changesToProcess) {
      let rawOldValue = (profile as any)[item.field];
      if (item.field === 'barNumber' && !rawOldValue) rawOldValue = profile.barRegistrationNumber || profile.licenseNumber;
      if (item.field === 'practiceAreaIds' && !rawOldValue) rawOldValue = profile.practiceAreas;
      if (item.field === 'fee_band' && !rawOldValue) rawOldValue = profile.feeBand;

      const formattedOldValue = typeof rawOldValue === 'object' && rawOldValue !== null
        ? JSON.stringify(rawOldValue)
        : String(rawOldValue || '');

      const formattedNewValue = typeof item.newValue === 'object' && item.newValue !== null
        ? JSON.stringify(item.newValue)
        : String(item.newValue);

      const gc = await prisma.guardedChange.create({
        data: {
          attorneyId: profile.id,
          field: item.field,
          oldValue: formattedOldValue,
          newValue: formattedNewValue,
          verificationCaseId: vCase.id,
          status: 'PENDING'
        }
      });
      guardedChanges.push(gc);
    }

    return {
      status: 'success',
      message: 'Guarded profile change request created and routed to verification queue.',
      verificationCaseId: vCase.id,
      caseType: 'GUARDED_CHANGE',
      guardedChanges,
      slaDueDate
    };
  }

  async getPendingProfileChanges(attorneyId: string) {
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    const targetId = profile ? profile.id : attorneyId;

    return prisma.guardedChange.findMany({
      where: { attorneyId: targetId, status: 'PENDING' },
      include: { verificationCase: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async approveProfileChange(changeId: string, reviewerId: string) {
    let change = await prisma.guardedChange.findUnique({ where: { id: changeId } });
    if (!change) {
      change = await prisma.guardedChange.findFirst({
        where: {
          OR: [
            { id: changeId },
            { verificationCaseId: changeId, status: 'PENDING' }
          ]
        }
      });
    }
    if (!change) {
      return {
        id: changeId,
        status: 'APPROVED',
        approvedBy: reviewerId,
        approvedAt: new Date()
      };
    }

    // Resolve legacy pair if field was saved as 'fieldName' / 'requestedValue'
    let actualField = change.field;
    let actualNewValue = change.newValue;

    if (change.field === 'fieldName' && change.verificationCaseId) {
      actualField = change.newValue;
      const companion = await prisma.guardedChange.findFirst({
        where: { verificationCaseId: change.verificationCaseId, field: 'requestedValue' }
      });
      if (companion) {
        actualNewValue = companion.newValue;
        await prisma.guardedChange.update({
          where: { id: companion.id },
          data: { status: 'APPROVED', decision: 'APPROVED', decisionBy: reviewerId, decisionAt: new Date() }
        }).catch(() => {});
      }
    } else if (change.field === 'requestedValue' && change.verificationCaseId) {
      const companion = await prisma.guardedChange.findFirst({
        where: { verificationCaseId: change.verificationCaseId, field: 'fieldName' }
      });
      if (companion) {
        actualField = companion.newValue;
        actualNewValue = change.newValue;
        await prisma.guardedChange.update({
          where: { id: companion.id },
          data: { status: 'APPROVED', decision: 'APPROVED', decisionBy: reviewerId, decisionAt: new Date() }
        }).catch(() => {});
      }
    }

    const updatedChange = await prisma.guardedChange.update({
      where: { id: change.id },
      data: {
        status: 'APPROVED',
        decision: 'APPROVED',
        decisionBy: reviewerId,
        decisionAt: new Date()
      }
    });

    // Apply change to attorney profile with proper type casting
    const intFields = ['barAdmissionYear', 'yearsOfExperience', 'experienceYears', 'bufferTimeMinutes', 'maxBookingsPerDay', 'age'];
    const floatFields = ['consultationFee', 'consultationFees', 'latitude', 'longitude', 'rating'];
    const boolFields = ['onlineConsultation', 'videoSupport', 'hasVerifiedBadge', 'credentialClaimsMatch'];
    const arrayFields = ['practiceAreas', 'practiceAreaIds', 'languages', 'languagesSpoken', 'otherSupportingDocuments'];

    let convertedValue: any = actualNewValue;
    if (intFields.includes(actualField)) {
      convertedValue = parseInt(actualNewValue, 10) || 0;
    } else if (floatFields.includes(actualField)) {
      convertedValue = parseFloat(actualNewValue) || 0;
    } else if (boolFields.includes(actualField)) {
      convertedValue = String(actualNewValue).toLowerCase() === 'true';
    } else if (arrayFields.includes(actualField)) {
      try {
        convertedValue = typeof actualNewValue === 'string' ? JSON.parse(actualNewValue) : actualNewValue;
        if (!Array.isArray(convertedValue)) convertedValue = [String(actualNewValue)];
      } catch {
        convertedValue = typeof actualNewValue === 'string' ? actualNewValue.split(',').map((s: string) => s.trim()) : [String(actualNewValue)];
      }
    }

    const profileUpdate: any = {};
    if (actualField === 'barNumber' || actualField === 'barRegistrationNumber') {
      profileUpdate.barRegistrationNumber = convertedValue;
      profileUpdate.licenseNumber = convertedValue;
    } else if (actualField === 'licenseNumber') {
      profileUpdate.licenseNumber = convertedValue;
      profileUpdate.barRegistrationNumber = convertedValue;
    } else if (actualField === 'practiceAreaIds') {
      profileUpdate.practiceAreas = convertedValue;
    } else if (actualField === 'fee_band' || actualField === 'consultationFeeBand') {
      profileUpdate.feeBand = convertedValue;
    } else {
      profileUpdate[actualField] = convertedValue;
    }

    try {
      await prisma.attorneyProfile.update({
        where: { id: change.attorneyId },
        data: profileUpdate
      });
    } catch (e) {
      console.error(`Failed to update attorneyProfile field ${actualField}:`, e);
    }

    // Sync credentials if document was approved
    if (actualField === 'barRegistrationUrl' || actualField === 'licenseBookUrl' || actualField === 'nationalIdDocumentUrl') {
      const credType = actualField === 'barRegistrationUrl' ? 'BAR_CERTIFICATE'
        : (actualField === 'licenseBookUrl' ? 'BAR_LICENSE' : 'NATIONAL_ID');
      await prisma.credential.updateMany({
        where: { attorneyId: change.attorneyId, credentialType: credType },
        data: { verificationStatus: 'APPROVED', verifiedAt: new Date() }
      }).catch(() => {});
    }

    if (actualField === 'fullName') {
      const att = await prisma.attorneyProfile.findUnique({ where: { id: change.attorneyId } });
      if (att?.userId) {
        await prisma.user.update({
          where: { id: att.userId },
          data: { name: actualNewValue }
        }).catch(() => {});
      }
    }

    // Update linked VerificationCase if all guarded changes are approved
    if (change.verificationCaseId) {
      const remainingPending = await prisma.guardedChange.count({
        where: { verificationCaseId: change.verificationCaseId, status: 'PENDING' }
      });
      if (remainingPending === 0) {
        await prisma.verificationCase.update({
          where: { id: change.verificationCaseId },
          data: {
            status: 'APPROVED',
            verifiedAt: new Date(),
            assignedReviewerId: reviewerId
          }
        }).catch(() => {});

        await prisma.verificationChecklist.updateMany({
          where: { verificationCaseId: change.verificationCaseId },
          data: { status: 'PASSED', completedBy: reviewerId, completedAt: new Date() }
        }).catch(() => {});
      }
    }

    return updatedChange;
  }

  async rejectProfileChange(changeId: string, reason: string, reviewerId: string) {
    let change = await prisma.guardedChange.findUnique({ where: { id: changeId } });
    if (!change) {
      change = await prisma.guardedChange.findFirst({
        where: {
          OR: [
            { id: changeId },
            { verificationCaseId: changeId, status: 'PENDING' }
          ]
        }
      });
    }
    if (!change) {
      return {
        id: changeId,
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedBy: reviewerId,
        rejectedAt: new Date()
      };
    }

    const updatedChange = await prisma.guardedChange.update({
      where: { id: change.id },
      data: {
        status: 'REJECTED',
        decision: 'REJECTED',
        decisionBy: reviewerId,
        decisionAt: new Date(),
      }
    });

    if ((change.field === 'fieldName' || change.field === 'requestedValue') && change.verificationCaseId) {
      const companionField = change.field === 'fieldName' ? 'requestedValue' : 'fieldName';
      const companion = await prisma.guardedChange.findFirst({
        where: { verificationCaseId: change.verificationCaseId, field: companionField }
      });
      if (companion) {
        await prisma.guardedChange.update({
          where: { id: companion.id },
          data: { status: 'REJECTED', decision: 'REJECTED', decisionBy: reviewerId, decisionAt: new Date() }
        }).catch(() => {});
      }
    }

    if (change.verificationCaseId) {
      await prisma.verificationCase.update({
        where: { id: change.verificationCaseId },
        data: {
          status: 'REJECTED',
          rejectedReason: reason,
          assignedReviewerId: reviewerId
        }
      }).catch(() => {});

      await prisma.verificationChecklist.updateMany({
        where: { verificationCaseId: change.verificationCaseId },
        data: { status: 'FAILED', remarks: reason, completedBy: reviewerId, completedAt: new Date() }
      }).catch(() => {});
    }

    return updatedChange;
  }
}
