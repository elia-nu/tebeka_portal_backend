import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';
import { StorageModule } from '@workspace/storage';
import { MetricsController, MetricsInterceptor, MetricsModule, TracingMiddleware } from '@workspace/common';

import { EventsModule } from './modules/events/events.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { SearchModule } from './modules/search/search.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { BookingModule } from './modules/booking/booking.module';
import { CaseModule } from './modules/case/case.module';
import { DocumentModule } from './modules/document/document.module';
import { ReviewModule } from './modules/review/review.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    MetricsModule,
    EventBusModule,
    AuthModule,
    StorageModule,
    EventsModule,
    DiscoveryModule,
    SearchModule,
    RankingModule,
    BookingModule,
    CaseModule,
    DocumentModule,
    ReviewModule,
    SchedulerModule,
    DashboardModule,
    AnalyticsModule,
  ],
  controllers: [MetricsController],
  providers: [
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('MARKETPLACE-SERVICE'),
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
