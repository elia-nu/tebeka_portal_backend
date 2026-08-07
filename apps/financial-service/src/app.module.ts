import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppConfigModule } from '@workspace/config';
import { AppLoggerModule, AppLoggerService, CorrelationIdMiddleware } from '@workspace/logger';
import { EventBusModule } from '@workspace/event-bus';
import { AuthModule } from '@workspace/auth';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    EventBusModule,
    AuthModule,
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
