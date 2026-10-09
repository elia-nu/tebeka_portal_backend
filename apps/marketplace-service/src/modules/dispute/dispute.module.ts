import { Module } from '@nestjs/common';
import { DisputeController } from './dispute.controller';
import { DisputeService } from './dispute.service';
import { DisputeResolutionService } from './services/dispute-resolution.service';
import { MarketplaceDatabaseModule } from '../../database/database.module';

@Module({
  imports: [MarketplaceDatabaseModule],
  controllers: [DisputeController],
  providers: [DisputeService, DisputeResolutionService],
  exports: [DisputeService, DisputeResolutionService],
})
export class DisputeModule {}

