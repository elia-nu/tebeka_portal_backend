import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, CorrelationIdMiddleware, AppLoggerService, HttpLoggingInterceptor } from '@workspace/logger';
import { AuthModule, JwtAuthGuard } from '@workspace/auth';
import { MetricsController, MetricsInterceptor, MetricsModule, TracingMiddleware } from '@workspace/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    MetricsModule,
    AuthModule,
    TerminusModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AppController, HealthController, MetricsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
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
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('API-GATEWAY'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware, TracingMiddleware).forRoutes('*');
  }
}
