import { Global, Module } from '@nestjs/common';
import { AppLoggerService } from './logger.service';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

@Global()
@Module({
  providers: [AppLoggerService, HttpLoggingInterceptor],
  exports: [AppLoggerService, HttpLoggingInterceptor],
})
export class AppLoggerModule {}

