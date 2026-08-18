import { Module } from '@nestjs/common';
import { MarketplaceSchedulerService } from './marketplace-scheduler.service';

@Module({
  providers: [MarketplaceSchedulerService],
  exports: [MarketplaceSchedulerService],
})
export class SchedulerModule {}
