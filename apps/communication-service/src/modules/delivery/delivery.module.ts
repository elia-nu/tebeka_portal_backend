import { Module } from '@nestjs/common';
import { EmailDeliveryService } from './email/email-delivery.service';
import { SmsDeliveryService } from './sms/sms-delivery.service';
import { PushDeliveryService } from './push/push-delivery.service';

@Module({
  providers: [EmailDeliveryService, SmsDeliveryService, PushDeliveryService],
  exports: [EmailDeliveryService, SmsDeliveryService, PushDeliveryService],
})
export class DeliveryModule {}
