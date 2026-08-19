import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { UserServiceClient } from '../../integrations/user-service.client';
import { RankingService } from '../ranking/ranking.service';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService, UserServiceClient, RankingService],
  exports: [DiscoveryService, UserServiceClient, RankingService],
})
export class DiscoveryModule {}
