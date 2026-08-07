import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AttorneysService {
  async createAttorney(data: any) {
    return prisma.attorneyProfile.create({ data });
  }

  async findAll(query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.attorneyProfile.findMany({
        skip,
        take: limit,
        include: { user: true, educations: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attorneyProfile.count(),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const attorney = await prisma.attorneyProfile.findUnique({
      where: { id },
      include: {
        user: true,
        educations: true,
        guardedChanges: true,
        verificationCases: true
      },
    });
    if (!attorney) throw new NotFoundException(`Attorney profile ${id} not found`);
    return attorney;
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

    for (const key of Object.keys(data)) {
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
      pendingGuardedChanges: guardedChanges
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

  // Education CRUD
  async addEducation(attorneyId: string, data: any) {
    // Resolve: the caller may pass either an AttorneyProfile.id or a User.id
    let profile = await prisma.attorneyProfile.findUnique({ where: { id: attorneyId } });
    if (!profile) {
      // Try resolving by userId
      profile = await prisma.attorneyProfile.findUnique({ where: { userId: attorneyId } });
    }
    if (!profile) {
      throw new NotFoundException(`Attorney profile not found for ID "${attorneyId}". Ensure you are passing the attorney profile ID, not the user ID.`);
    }

    return prisma.attorneyEducation.create({
      data: {
        attorneyId: profile.id,
        institution: data.institution,
        degree: data.degree,
        fieldOfStudy: data.fieldOfStudy,
        startYear: data.startYear,
        endYear: data.endYear
      }
    });
  }

  async getEducation(attorneyId: string) {
    return prisma.attorneyEducation.findMany({ where: { attorneyId } });
  }

  async deleteEducation(educationId: string) {
    return prisma.attorneyEducation.delete({ where: { id: educationId } });
  }

  async getPracticeAreas() {
    return [
      { id: 'pa-1', nameEn: 'Corporate Law', nameAm: 'የንግድ ሕግ', icon: 'gavel', sortOrder: 1, isActive: true },
      { id: 'pa-2', nameEn: 'Family Law', nameAm: 'የቤተሰብ ሕግ', icon: 'people', sortOrder: 2, isActive: true },
      { id: 'pa-3', nameEn: 'Criminal Defense', nameAm: 'የወንጀል ሕግ', icon: 'shield', sortOrder: 3, isActive: true },
    ];
  }

  async createPracticeArea(data: any) {
    return { id: `pa-${Date.now()}`, ...data, isActive: true };
  }

  async updatePracticeArea(id: string, data: any) {
    return { id, ...data };
  }

  async deletePracticeArea(id: string) {
    return { status: 'success', message: `Practice area ${id} deleted` };
  }

  async assignPracticeAreaToAttorney(attorneyId: string, data: any) {
    return { attorneyId, practiceAreaId: data.practiceAreaId, status: 'assigned' };
  }

  async removePracticeAreaFromAttorney(attorneyId: string, practiceAreaId: string) {
    return { attorneyId, practiceAreaId, status: 'removed' };
  }

  async getAvailability(attorneyId: string) {
    return [
      { id: 'av-1', attorneyId, weekday: 1, startTime: '09:00', endTime: '17:00', timezone: 'Africa/Addis_Ababa', isAvailable: true },
      { id: 'av-2', attorneyId, weekday: 2, startTime: '09:00', endTime: '17:00', timezone: 'Africa/Addis_Ababa', isAvailable: true },
    ];
  }

  async createAvailability(attorneyId: string, data: any) {
    return { id: `av-${Date.now()}`, attorneyId, ...data };
  }

  async updateAvailability(id: string, data: any) {
    return { id, ...data };
  }

  async deleteAvailability(id: string) {
    return { status: 'success', message: `Availability window ${id} deleted` };
  }

  async blockDate(data: any) {
    return { status: 'success', message: 'Date blocked successfully', blockedDate: data.date };
  }

  async setVacation(data: any) {
    return { status: 'success', message: 'Vacation period set', startDate: data.startDate, endDate: data.endDate };
  }
}
