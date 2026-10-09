import { Module } from '@nestjs/common';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';
import { CaseAgreementService } from './services/case-agreement.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';

@Module({
  controllers: [CaseController],
  providers: [CaseService, CaseAgreementService, CommunicationServiceClient],
  exports: [CaseService, CaseAgreementService],
})
export class CaseModule {}

