import { Module } from '@nestjs/common';
import { AuthModule } from '@workspace/auth';
import { AttorneysController } from './attorneys.controller';
import { AttorneyProfileService } from './services/attorney-profile.service';
import { AttorneyProfileChangeService } from './services/attorney-profile-change.service';
import { AttorneyVaultService } from './services/attorney-vault.service';
import { AttorneyEducationService } from './services/attorney-education.service';
import { AttorneyScheduleService } from './services/attorney-schedule.service';
import { AttorneyGoogleCalendarService } from './services/google-calendar.service';
import { AttorneyModerationService } from './services/attorney-moderation.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [AttorneysController],
  providers: [
    AttorneyProfileService,
    AttorneyModerationService,
    AttorneyVaultService,
    AttorneyEducationService,
    AttorneyScheduleService,
    AttorneyProfileChangeService,
    AttorneyGoogleCalendarService,
  ],
  exports: [
    AttorneyProfileService,
    AttorneyModerationService,
    AttorneyVaultService,
    AttorneyGoogleCalendarService,
    AttorneyProfileChangeService,
  ],
})
export class AttorneysModule {}

