import { Module } from '@nestjs/common';
import { AuthModule } from '@workspace/auth';
import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';
import { AttorneysModule } from '../attorneys/attorneys.module';

@Module({
  // AuthModule registers the 'jwt' Passport strategy that this controller's
  // class-level @UseGuards(JwtAuthGuard, RolesGuard) depends on.
  imports: [AuthModule, AttorneysModule],
  controllers: [AdministrationController],
  providers: [AdministrationService],
  exports: [AdministrationService],
})
export class AdministrationModule {}
