import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';
import { DatabaseModule } from '@workspace/database';
import { MetricsController, MetricsInterceptor, TracingMiddleware } from '@workspace/common';
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
  controllers: [MetricsController],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('FINANCIAL-SERVICE'),
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, TracingMiddleware).forRoutes('*');
  }
}
