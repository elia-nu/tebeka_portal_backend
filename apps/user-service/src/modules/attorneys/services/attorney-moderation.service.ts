import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@workspace/database';
import { sanitizeUser } from '../../users/users.service';

@Injectable()
export class AttorneyModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async publishProfile(id: string) {
    const attorney = await this.prisma.attorneyProfile.findUnique({ where: { id } });
    if (!attorney) throw new NotFoundException('Attorney profile not found');

    if (attorney.verificationStatus !== 'APPROVED') {
      throw new BadRequestException(
        'Cannot publish profile: Verification status must be APPROVED'
      );
    }
    if (attorney.profileCompleteness < 80) {
      throw new BadRequestException(
        `Cannot publish profile: Profile completeness (${attorney.profileCompleteness}%) must be at least 80%`
      );
    }
    if (!attorney.feeBand) {
      throw new BadRequestException('Cannot publish profile: Fee band must be selected');
    }
    if (!attorney.credentialClaimsMatch) {
      throw new BadRequestException(
        'Cannot publish profile: Credential claims must match verified credentials'
      );
    }

    return this.prisma.attorneyProfile.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }

  async hideProfile(id: string) {
    return this.prisma.attorneyProfile.update({ where: { id }, data: { status: 'INACTIVE' } });
  }

  async moderateProfile(
    id: string,
    actionData: { action: 'WARN' | 'SUSPEND' | 'RESTORE'; reasonCode: string; adminNote: string }
  ) {
    let attorney = await this.prisma.attorneyProfile.findUnique({ where: { id } });
    if (!attorney) {
      attorney = await this.prisma.attorneyProfile.findUnique({ where: { userId: id } });
    }
    if (!attorney) throw new NotFoundException(`Attorney profile ${id} not found`);

    let newStatus = attorney.status;
    if (actionData.action === 'SUSPEND') {
      newStatus = 'SUSPENDED';
    } else if (actionData.action === 'RESTORE') {
      newStatus = 'ACTIVE';
    }

    await this.prisma.attorneyProfile.update({
      where: { id: attorney.id },
      data: { status: newStatus },
    });

    return {
      status: 'success',
      action: actionData.action,
      reasonCode: actionData.reasonCode,
      adminNote: actionData.adminNote,
      profileStatus: newStatus,
      notificationSent: true,
    };
  }
}
