import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';

@Module({
  controllers: [BookingController],
  providers: [BookingService, CommunicationServiceClient],
  exports: [BookingService],
})
export class BookingModule {}
