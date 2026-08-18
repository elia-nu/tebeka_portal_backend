import { Module } from '@nestjs/common';
import { AuthModule } from '@workspace/auth';
import { AttorneysController } from './attorneys.controller';
import { AttorneyProfileService } from './services/attorney-profile.service';
import { AttorneyEducationService } from './services/attorney-education.service';
import { AttorneyScheduleService } from './services/attorney-schedule.service';
import { AttorneyProfileChangeService } from './services/attorney-profile-change.service';
import { UsersModule } from '../users/users.module';

@Module({
  // AuthModule registers the 'jwt' Passport strategy that JwtAuthGuard (used on
  // moderateProfile/approveProfileChange/rejectProfileChange) depends on.
  imports: [UsersModule, AuthModule],
  controllers: [AttorneysController],
  providers: [
    AttorneyProfileService,
    AttorneyEducationService,
    AttorneyScheduleService,
    AttorneyProfileChangeService,
  ],
  exports: [AttorneyProfileService],
})
export class AttorneysModule {}
