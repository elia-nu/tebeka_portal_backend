import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';
import { DatabaseModule } from '@workspace/database';
import { PaymentModule } from './modules/payments/payment.module';
import { FinancialEventsModule } from './modules/events/financial-events.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    EventBusModule,
    AuthModule,
    DatabaseModule,
    FinancialEventsModule,
    PaymentModule,
  ],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('FINANCIAL-SERVICE'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
