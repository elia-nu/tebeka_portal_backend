import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware, HttpLoggingInterceptor } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';
import { FinancialDatabaseModule } from './database/database.module';
import { MetricsController, MetricsInterceptor, MetricsModule, TracingMiddleware, SanitizeResponseInterceptor, AppHealthModule } from '@workspace/common';
import { PaymentModule } from './modules/payments/payment.module';
import { FinancialEventsModule } from './modules/events/financial-events.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    MetricsModule,
    AppHealthModule,
    EventBusModule,
    AuthModule,
    FinancialDatabaseModule,
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
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizeResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, TracingMiddleware).forRoutes('*');
  }
}
