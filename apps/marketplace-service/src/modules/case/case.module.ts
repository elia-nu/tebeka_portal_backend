import { Module } from '@nestjs/common';
import { CaseController } from './case.controller';
import { CaseService } from './case.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';

@Module({
  controllers: [CaseController],
  providers: [CaseService, CommunicationServiceClient],
  exports: [CaseService],
})
export class CaseModule {}
