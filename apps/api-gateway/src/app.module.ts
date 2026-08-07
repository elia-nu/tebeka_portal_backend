import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, CorrelationIdMiddleware, AppLoggerService } from '@workspace/logger';
import { AuthModule, JwtAuthGuard } from '@workspace/auth';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [AppConfigModule, AppLoggerModule, AuthModule, TerminusModule],
  controllers: [AppController, HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: AppLoggerService,
      useFactory: () => new AppLoggerService('API-GATEWAY'),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
