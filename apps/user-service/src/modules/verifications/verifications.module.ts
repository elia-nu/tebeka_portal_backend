import { Module } from '@nestjs/common';
import { EventBusModule } from '@workspace/event-bus';
import { VerificationsController } from './verifications.controller';
import { VerificationCaseService } from './services/verification-case.service';
import { VerificationDecisionService } from './services/verification-decision.service';
import { VerificationFraudService } from './services/verification-fraud.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [EventBusModule, UsersModule],
  controllers: [VerificationsController],
  providers: [VerificationCaseService, VerificationDecisionService, VerificationFraudService],
  exports: [VerificationCaseService],
})
export class VerificationsModule {}
