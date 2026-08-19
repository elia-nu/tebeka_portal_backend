import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingCancellationService } from './services/booking-cancellation.service';
import { BookingRescheduleService } from './services/booking-reschedule.service';
import { BookingDisputeService } from './services/booking-dispute.service';
import { GoogleMeetService } from '../integrations/google-meet.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';

@Module({
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingCancellationService,
    BookingRescheduleService,
    BookingDisputeService,
    GoogleMeetService,
    CommunicationServiceClient,
  ],
  exports: [
    BookingService,
    BookingCancellationService,
    BookingRescheduleService,
    BookingDisputeService,
  ],
})
export class BookingModule {}
