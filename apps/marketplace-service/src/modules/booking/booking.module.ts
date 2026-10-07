import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { BookingCancellationService } from './services/booking-cancellation.service';
import { BookingRescheduleService } from './services/booking-reschedule.service';
import { BookingDisputeService } from './services/booking-dispute.service';
import { BookingCheckoutService } from './services/booking-checkout.service';
import { GoogleMeetService } from '../integrations/google-meet.service';
import { CommunicationServiceClient } from '../../integrations/communication-service.client';
import { UserServiceClient } from '../../integrations/user-service.client';
import { FinancialServiceClient } from '../../integrations/financial-service.client';

@Module({
  controllers: [BookingController],
  providers: [
    BookingService,
    BookingCancellationService,
    BookingRescheduleService,
    BookingDisputeService,
    BookingCheckoutService,
    GoogleMeetService,
    CommunicationServiceClient,
    UserServiceClient,
    FinancialServiceClient,
  ],
  exports: [
    BookingService,
    BookingCancellationService,
    BookingRescheduleService,
    BookingDisputeService,
    BookingCheckoutService,
  ],
})
export class BookingModule {}
