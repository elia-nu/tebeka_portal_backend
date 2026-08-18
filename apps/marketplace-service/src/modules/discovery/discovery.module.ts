import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { UserServiceClient } from '../../integrations/user-service.client';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService, UserServiceClient],
  exports: [DiscoveryService, UserServiceClient],
})
export class DiscoveryModule {}
