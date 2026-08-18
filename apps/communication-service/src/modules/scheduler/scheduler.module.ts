import { Module } from '@nestjs/common';
import { CommunicationSchedulerService } from './communication-scheduler.service';
import { DeliveryModule } from '../delivery/delivery.module';

@Module({
  imports: [DeliveryModule],
  providers: [CommunicationSchedulerService],
  exports: [CommunicationSchedulerService],
})
export class CommunicationSchedulerModule {}
