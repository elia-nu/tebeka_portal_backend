import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '@workspace/database';
import { EventBusService } from '@workspace/event-bus';
import { sanitizeUser } from '../../users/users.service';

@Injectable()
export class AttorneyModerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService
  ) {}

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

    const updated = await this.prisma.attorneyProfile.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    if (this.eventBus) {
      await this.eventBus.publish('ATTORNEY_VERIFIED', {
        attorneyId: id,
        verifiedAt: updated.verifiedAt || new Date(),
      });
    }

    return updated;
  }

  async hideProfile(id: string) {
    const updated = await this.prisma.attorneyProfile.update({ where: { id }, data: { status: 'INACTIVE' } });
    if (this.eventBus) {
      await this.eventBus.publish('ATTORNEY_SUSPENDED', {
        attorneyId: id,
        reason: 'PROFILE_HIDDEN',
      });
    }
    return updated;
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

    if (this.eventBus) {
      if (actionData.action === 'SUSPEND') {
        await this.eventBus.publish('ATTORNEY_SUSPENDED', {
          attorneyId: attorney.id,
          reason: actionData.reasonCode,
        });
      } else if (actionData.action === 'RESTORE' && attorney.verificationStatus === 'APPROVED') {
        await this.eventBus.publish('ATTORNEY_VERIFIED', {
          attorneyId: attorney.id,
          verifiedAt: attorney.verifiedAt || new Date(),
        });
      }
    }

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
