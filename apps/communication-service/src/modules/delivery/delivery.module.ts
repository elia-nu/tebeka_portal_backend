import { Module } from '@nestjs/common';
import { SmsModule } from '@workspace/sms';
import { EmailDeliveryService } from './email/email-delivery.service';
import { SmsDeliveryService } from './sms/sms-delivery.service';
import { PushDeliveryService } from './push/push-delivery.service';

@Module({
  imports: [SmsModule],
  providers: [EmailDeliveryService, SmsDeliveryService, PushDeliveryService],
  exports: [EmailDeliveryService, SmsDeliveryService, PushDeliveryService, SmsModule],
})
export class DeliveryModule {}

