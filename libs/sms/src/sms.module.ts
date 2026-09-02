import { Module, Global } from '@nestjs/common';
import { SmsService } from './sms.service';
import { AfroMessageProvider } from './providers/afromessage.provider';
import { AppLoggerModule } from '@workspace/logger';

@Global()
@Module({
  imports: [AppLoggerModule],
  providers: [AfroMessageProvider, SmsService],
  exports: [SmsService, AfroMessageProvider],
})
export class SmsModule {}
