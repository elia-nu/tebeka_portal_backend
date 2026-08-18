import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EmailDeliveryService } from '../delivery/email/email-delivery.service';
import { SmsDeliveryService } from '../delivery/sms/sms-delivery.service';
import { PushDeliveryService } from '../delivery/push/push-delivery.service';
import { AppLoggerService } from '@workspace/logger';

@Injectable()
export class CommunicationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private intervalRef: any = null;

  constructor(
    private readonly emailDeliveryService: EmailDeliveryService,
    private readonly smsDeliveryService: SmsDeliveryService,
    private readonly pushDeliveryService: PushDeliveryService,
    private readonly logger: AppLoggerService
  ) {}

  onModuleInit() {
    this.logger.log('Starting CommunicationScheduler background worker (30s interval)...', 'CommunicationSchedulerService');
    this.intervalRef = setInterval(async () => {
      try {
        await Promise.all([
          this.emailDeliveryService.processPendingEmailJobs(),
          this.smsDeliveryService.processPendingSmsJobs(),
          this.pushDeliveryService.processPendingPushJobs(),
        ]);
      } catch (err: any) {
        this.logger.error(`Error in CommunicationScheduler: ${err?.message}`, err?.stack, 'CommunicationSchedulerService');
      }
    }, 30000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }
}
